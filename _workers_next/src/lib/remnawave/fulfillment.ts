import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "../db";
import { loginUsers, orders, products } from "../db/schema";
import { prorateRenewal } from "../prorate";
import { computeTier } from "../tier";
import { RemnawaveClient, REMNAWAVE_GIB, type RemnawaveUser } from "./client";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMNAWAVE_PRODUCT_TYPE = "remnawave_subscription";

type FulfillmentStatus = "processed" | "already_processed";

type RemnawaveFulfillmentOrder = {
    orderId: string;
    productId: string;
    productName: string;
    amount: string;
    status: string | null;
    userId: string | null;
    username: string | null;
    months: number | null;
    monthlyLdc: number | null;
    linuxdoId: string | null;
    linuxdoUsername: string | null;
};

type PriorRemnawaveOrder = {
    orderId: string;
    paidAt: Date | null;
    expireAt: Date | null;
    months: number | null;
    monthlyLdc: number | null;
};

export type RemnawaveProvisioner = Pick<RemnawaveClient, "createOrUpdateUser">;

export type RemnawaveFulfillmentStore = {
    getOrderWithUser(orderId: string): Promise<RemnawaveFulfillmentOrder | null>;
    getPriorPaidRemnawaveOrders(args: { userId: string; orderId: string }): Promise<PriorRemnawaveOrder[]>;
    markOrderPaidIfPending(args: { orderId: string; tradeNo: string; paidAt: Date }): Promise<boolean>;
    persistProvisioningResult(args: {
        orderId: string;
        subscriptionUrl: string;
        expireAt: Date;
        deliveredAt: Date;
        tradeNo: string;
    }): Promise<void>;
};

type FulfillmentDeps = {
    store?: RemnawaveFulfillmentStore;
    client?: RemnawaveProvisioner;
    now?: () => Date;
    env?: NodeJS.ProcessEnv;
    logger?: Pick<Console, "error">;
};

export async function fulfillRemnawaveOrder(
    orderId: string,
    paidAmount: number,
    tradeNo: string,
    deps: FulfillmentDeps = {},
): Promise<{ success: true; status: FulfillmentStatus }> {
    const store = deps.store ?? defaultRemnawaveFulfillmentStore;
    const now = deps.now ?? (() => new Date());
    const env = deps.env ?? process.env;
    const logger = deps.logger ?? console;

    const order = await store.getOrderWithUser(orderId);
    if (!order) {
        throw new Error(`Order ${orderId} not found`);
    }

    const orderMoney = parseFloat(order.amount);
    if (Math.abs(paidAmount - orderMoney) > 0.01) {
        throw new Error(`Amount mismatch! Order: ${orderMoney}, Paid: ${paidAmount}`);
    }

    if (order.status !== "pending" && order.status !== "cancelled") {
        return { success: true, status: "already_processed" };
    }

    const linuxdoId = order.linuxdoId ?? order.userId;
    const linuxdoUsername = order.linuxdoUsername ?? order.username;
    if (!linuxdoId) {
        throw new Error(`Order ${orderId} has no linux.do user id`);
    }

    const priorOrders = await store.getPriorPaidRemnawaveOrders({ userId: linuxdoId, orderId });
    const paidAt = now();
    const claimed = await store.markOrderPaidIfPending({ orderId, tradeNo, paidAt });
    if (!claimed) {
        return { success: true, status: "already_processed" };
    }

    try {
        const currentDaysLeft = computeCurrentDaysLeft(priorOrders, paidAt);
        const oldRate = latestMonthlyLdc(priorOrders);
        const newRate = resolveNewRate(order, paidAmount);
        const paymentLdc = Math.trunc(paidAmount);
        const newDays = prorateRenewal(currentDaysLeft, oldRate, newRate, paymentLdc);
        const daysToAdd = newDays - currentDaysLeft;
        const tier = computeTier(
            newRate,
            readRequiredIntegerEnv(env, "TIER1_THRESHOLD"),
            readRequiredIntegerEnv(env, "TIER2_THRESHOLD"),
        );
        const trafficLimitBytes = newRate * REMNAWAVE_GIB;

        const client = deps.client ?? new RemnawaveClient({
            baseUrl: readRequiredStringEnv(env, "REMNAWAVE_BASE_URL"),
            token: readRequiredStringEnv(env, "REMNAWAVE_TOKEN"),
            externalSquadUuid: env.EXTERNAL_SQUAD_UUID,
        });

        const result = await client.createOrUpdateUser({
            linuxdoSub: linuxdoId,
            linuxdoUsername: linuxdoUsername || linuxdoId,
            trafficLimitBytes,
            daysToAdd,
            isTrial: false,
            tier,
        });

        await store.persistProvisioningResult({
            orderId,
            subscriptionUrl: result.subscriptionUrl,
            expireAt: parseExpireAt(result),
            deliveredAt: now(),
            tradeNo,
        });
    } catch (error) {
        logger.error("[Fulfill][Remnawave] provisioning failed after paid mark", {
            orderId,
            tradeNo,
            error: serializeError(error),
        });
    }

    return { success: true, status: "processed" };
}

function computeCurrentDaysLeft(priorOrders: PriorRemnawaveOrder[], now: Date) {
    const withExpireAt = priorOrders.find((order) => order.expireAt);
    if (withExpireAt?.expireAt) {
        return daysRemaining(withExpireAt.expireAt, now);
    }

    const latestWithPaidAt = priorOrders.find((order) => order.paidAt && order.months && order.months > 0);
    if (!latestWithPaidAt?.paidAt || !latestWithPaidAt.months) {
        return 0;
    }

    return daysRemaining(new Date(latestWithPaidAt.paidAt.getTime() + latestWithPaidAt.months * 30 * DAY_MS), now);
}

function latestMonthlyLdc(priorOrders: PriorRemnawaveOrder[]) {
    const latest = priorOrders[0];
    return latest?.monthlyLdc ?? 0;
}

function daysRemaining(expireAt: Date, now: Date) {
    const remaining = expireAt.getTime() - now.getTime();
    if (remaining <= 0) return 0;
    return Math.trunc(remaining / DAY_MS);
}

function resolveNewRate(order: RemnawaveFulfillmentOrder, paidAmount: number) {
    if (order.monthlyLdc && order.monthlyLdc > 0) {
        return Math.trunc(order.monthlyLdc);
    }
    if (order.months && order.months > 0) {
        return Math.trunc(paidAmount / order.months);
    }
    throw new Error(`Order ${order.orderId} is missing monthly_ldc/months`);
}

function readRequiredStringEnv(env: NodeJS.ProcessEnv, key: string) {
    const value = env[key]?.trim();
    if (!value || value === "PLACEHOLDER_REPLACE_ME") {
        throw new Error(`Missing required environment variable ${key}`);
    }
    return value;
}

function readRequiredIntegerEnv(env: NodeJS.ProcessEnv, key: string) {
    const raw = readRequiredStringEnv(env, key);
    const value = Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`Environment variable ${key} must be an integer`);
    }
    return value;
}

function parseExpireAt(result: RemnawaveUser) {
    const expireAt = new Date(result.expireAt);
    if (Number.isNaN(expireAt.getTime())) {
        throw new Error(`Remnawave returned invalid expireAt: ${result.expireAt}`);
    }
    return expireAt;
}

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return { message: String(error) };
}

export const defaultRemnawaveFulfillmentStore: RemnawaveFulfillmentStore = {
    async getOrderWithUser(orderId) {
        const rows = await db.select({
            orderId: orders.orderId,
            productId: orders.productId,
            productName: orders.productName,
            amount: orders.amount,
            status: orders.status,
            userId: orders.userId,
            username: orders.username,
            months: orders.months,
            monthlyLdc: orders.monthlyLdc,
            linuxdoId: loginUsers.userId,
            linuxdoUsername: loginUsers.username,
        })
            .from(orders)
            .leftJoin(loginUsers, eq(orders.userId, loginUsers.userId))
            .where(eq(orders.orderId, orderId))
            .limit(1);

        return rows[0] ?? null;
    },

    async getPriorPaidRemnawaveOrders({ userId, orderId }) {
        return await db.select({
            orderId: orders.orderId,
            paidAt: orders.paidAt,
            expireAt: orders.expireAt,
            months: orders.months,
            monthlyLdc: orders.monthlyLdc,
        })
            .from(orders)
            .innerJoin(products, eq(orders.productId, products.id))
            .where(and(
                eq(orders.userId, userId),
                ne(orders.orderId, orderId),
                eq(products.type, REMNAWAVE_PRODUCT_TYPE),
                inArray(orders.status, ["paid", "delivered"]),
            ))
            .orderBy(desc(orders.paidAt), desc(orders.createdAt));
    },

    async markOrderPaidIfPending({ orderId, tradeNo, paidAt }) {
        // D1 forbids raw `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` statements
        // (state.storage.transaction() is the documented escape hatch). A single
        // `UPDATE ... WHERE status IN (...) ... RETURNING` is already atomic on
        // D1 / SQLite, so the CAS-once contract is preserved without a wrapper:
        // first call wins the row, concurrent / retried calls match 0 rows and
        // return false → caller branches to "already_processed".
        const rows = await db.update(orders)
            .set({
                status: "paid",
                paidAt,
                tradeNo,
                currentPaymentId: null,
            })
            .where(and(eq(orders.orderId, orderId), inArray(orders.status, ["pending", "cancelled"])))
            .returning({ orderId: orders.orderId });
        return rows.length > 0;
    },

    async persistProvisioningResult({ orderId, subscriptionUrl, expireAt, deliveredAt, tradeNo }) {
        await db.update(orders)
            .set({
                status: "delivered",
                deliveredAt,
                tradeNo,
                subscriptionUrl,
                expireAt,
                currentPaymentId: null,
            })
            .where(eq(orders.orderId, orderId));
    },
};

export const remnawaveFulfillmentInternals = {
    computeCurrentDaysLeft,
};
