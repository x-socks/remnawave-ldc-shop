export const REMNAWAVE_SUBSCRIPTION_PRODUCT_ID = "remnawave_subscription"

export const TIER_RATES = {
    LV0: 5,
    LV1: 10,
    LV2: 20,
} as const

export type RemnawaveTier = keyof typeof TIER_RATES

export function isRemnawaveTier(value: unknown): value is RemnawaveTier {
    return typeof value === "string" && value in TIER_RATES
}

export function normalizeSubscriptionMonths(value: unknown) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null
    if (parsed < 1 || parsed > 12) return null
    return parsed
}
