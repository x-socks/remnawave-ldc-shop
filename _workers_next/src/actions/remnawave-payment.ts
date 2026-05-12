'use server'

import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { withOrderColumnFallback, getProduct } from "@/lib/db/queries"
import { generateOrderId } from "@/lib/crypto"
import { buildPaymentSubmitParams } from "@/actions/payment"
import { TIER_RATES, isRemnawaveTier, normalizeSubscriptionMonths } from "@/lib/remnawave-subscription"

interface CreateRemnawavePaymentInput {
    productId: string
    tier: string
    months: number
    monthlyLdc: number
}

function isLinuxDoUserId(userId: string | null | undefined) {
    return !!userId && !userId.startsWith("github:")
}

export async function createRemnawavePaymentOrder(input: CreateRemnawavePaymentInput) {
    const session = await auth()
    const user = session?.user

    if (!isLinuxDoUserId(user?.id)) {
        return { success: false, error: "Please sign in with Linux DO before paying." }
    }

    const productId = String(input.productId || "").trim()
    const tier = String(input.tier || "").trim()
    const months = normalizeSubscriptionMonths(input.months)
    const monthlyLdc = Number(input.monthlyLdc)

    if (!productId) {
        return { success: false, error: "Missing product." }
    }
    if (!isRemnawaveTier(tier)) {
        return { success: false, error: "Select a valid tier." }
    }
    if (!months) {
        return { success: false, error: "Months must be an integer from 1 to 12." }
    }
    if (!Number.isFinite(monthlyLdc) || !Number.isInteger(monthlyLdc) || monthlyLdc <= 0) {
        return { success: false, error: "Monthly LDC must be a positive integer." }
    }
    if (monthlyLdc !== TIER_RATES[tier]) {
        return { success: false, error: "Tier price changed. Refresh and try again." }
    }

    const product = await getProduct(productId, { isLoggedIn: true, trustLevel: 999 }).catch(() => null)
    if (!product || product.type !== "remnawave_subscription") {
        return { success: false, error: "Remnawave Subscription product not found." }
    }

    const amount = monthlyLdc * months
    if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: "Invalid payment amount." }
    }

    const orderId = generateOrderId()

    await withOrderColumnFallback(async () => {
        await db.insert(orders).values({
            orderId,
            productId: product.id,
            productName: product.name,
            amount: String(amount),
            email: user?.email || null,
            userId: user!.id,
            username: user?.username || user?.name || null,
            tier,
            months,
            monthlyLdc,
            status: "pending",
            quantity: 1,
            currentPaymentId: orderId,
            createdAt: new Date(),
        })
    })

    const cookieStore = await cookies()
    cookieStore.set("ldc_pending_order", orderId, { secure: true, path: "/", sameSite: "lax" })

    const payment = await buildPaymentSubmitParams(orderId, product.name, amount)
    if (!payment) {
        return { success: false, error: "Invalid payment amount." }
    }

    return {
        success: true,
        url: payment.url,
        params: payment.params,
    }
}
