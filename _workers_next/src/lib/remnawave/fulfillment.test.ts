import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

import { fulfillRemnawaveOrder, type RemnawaveFulfillmentStore, type RemnawaveProvisioner } from "./fulfillment";
import { REMNAWAVE_GIB } from "./client";

const NOW = new Date("2026-05-12T00:00:00.000Z");

type TestOrder = Awaited<ReturnType<RemnawaveFulfillmentStore["getOrderWithUser"]>>;
type TestPriorOrder = Awaited<ReturnType<RemnawaveFulfillmentStore["getPriorPaidRemnawaveOrders"]>>[number];

function makeOrder(overrides: Partial<NonNullable<TestOrder>> = {}): NonNullable<TestOrder> {
    return {
        orderId: "ORDER1",
        productId: "remnawave_subscription",
        productName: "Remnawave Subscription",
        amount: "30",
        status: "pending",
        userId: "123",
        username: "linuxdo_user",
        months: 3,
        monthlyLdc: 10,
        linuxdoId: "123",
        linuxdoUsername: "linuxdo_user",
        ...overrides,
    };
}

function makeStore(order: NonNullable<TestOrder>, priorOrders: TestPriorOrder[] = []) {
    const store: RemnawaveFulfillmentStore = {
        getOrderWithUser: vi.fn(async () => order),
        getPriorPaidRemnawaveOrders: vi.fn(async () => priorOrders),
        markOrderPaidIfPending: vi.fn(async () => {
            if (order.status !== "pending" && order.status !== "cancelled") {
                return false;
            }
            order.status = "paid";
            return true;
        }),
        persistProvisioningResult: vi.fn(async ({ subscriptionUrl, expireAt }) => {
            order.status = "delivered";
            (order as any).subscriptionUrl = subscriptionUrl;
            (order as any).expireAt = expireAt;
        }),
    };
    return store;
}

function makeClient() {
    const createOrUpdateUser = vi.fn<RemnawaveProvisioner["createOrUpdateUser"]>();
    createOrUpdateUser.mockResolvedValue({
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        username: "linuxdo_123_linuxdo_user",
        externalId: "linuxdo_123",
        subscriptionUrl: "https://sub.example/123",
        expireAt: "2026-08-10T00:00:00.000Z",
    });
    return {
        createOrUpdateUser,
    };
}

function env() {
    return {
        TIER1_THRESHOLD: "10",
        TIER2_THRESHOLD: "20",
        REMNAWAVE_BASE_URL: "https://panel.example.com",
        REMNAWAVE_TOKEN: "token",
    } as unknown as NodeJS.ProcessEnv;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("fulfillRemnawaveOrder", () => {
    it("provisions a first purchase for months * 30 days", async () => {
        const order = makeOrder({ amount: "30", months: 3, monthlyLdc: 10 });
        const store = makeStore(order);
        const client = makeClient();

        await expect(fulfillRemnawaveOrder("ORDER1", 30, "TRADE1", {
            store,
            client,
            env: env(),
            now: () => new Date(NOW),
        })).resolves.toEqual({ success: true, status: "processed" });

        expect(client.createOrUpdateUser).toHaveBeenCalledOnce();
        expect(client.createOrUpdateUser).toHaveBeenCalledWith({
            linuxdoSub: "123",
            linuxdoUsername: "linuxdo_user",
            trafficLimitBytes: 10 * REMNAWAVE_GIB,
            daysToAdd: 90,
            isTrial: false,
            tier: "LV1",
        });
        expect(store.persistProvisioningResult).toHaveBeenCalledOnce();
    });

    it("adds months * 30 days on renewal at the same rate", async () => {
        const order = makeOrder({ amount: "20", months: 2, monthlyLdc: 10 });
        const store = makeStore(order, [{
            orderId: "OLDER",
            paidAt: new Date("2026-05-01T00:00:00.000Z"),
            expireAt: new Date("2026-05-27T00:00:00.000Z"),
            months: 1,
            monthlyLdc: 10,
        }]);
        const client = makeClient();

        await fulfillRemnawaveOrder("ORDER1", 20, "TRADE1", {
            store,
            client,
            env: env(),
            now: () => new Date(NOW),
        });

        expect(client.createOrUpdateUser.mock.calls[0]![0].daysToAdd).toBe(60);
    });

    it("subtracts existing days from an upgrade result before calling Remnawave", async () => {
        const order = makeOrder({ amount: "20", months: 1, monthlyLdc: 20 });
        const store = makeStore(order, [{
            orderId: "OLDER",
            paidAt: new Date("2026-04-20T00:00:00.000Z"),
            expireAt: new Date("2026-06-11T00:00:00.000Z"),
            months: 2,
            monthlyLdc: 10,
        }]);
        const client = makeClient();

        await fulfillRemnawaveOrder("ORDER1", 20, "TRADE1", {
            store,
            client,
            env: env(),
            now: () => new Date(NOW),
        });

        const args = client.createOrUpdateUser.mock.calls[0]![0];
        expect(args.daysToAdd).toBe(15);
        expect(args.daysToAdd).toBeLessThan(45);
        expect(args.tier).toBe("LV2");
    });

    it("claims the order once and does not provision on a duplicate call", async () => {
        const order = makeOrder();
        const store = makeStore(order);
        const client = makeClient();
        const deps = {
            store,
            client,
            env: env(),
            now: () => new Date(NOW),
        };

        await fulfillRemnawaveOrder("ORDER1", 30, "TRADE1", deps);
        await expect(fulfillRemnawaveOrder("ORDER1", 30, "TRADE1", deps))
            .resolves.toEqual({ success: true, status: "already_processed" });

        expect(client.createOrUpdateUser).toHaveBeenCalledOnce();
        expect(store.markOrderPaidIfPending).toHaveBeenCalledOnce();
    });
});
