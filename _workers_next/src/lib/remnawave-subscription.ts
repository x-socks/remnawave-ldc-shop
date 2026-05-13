export const REMNAWAVE_SUBSCRIPTION_PRODUCT_ID = "remnawave_subscription"

export const DEFAULT_LDC_MIN_MONTHLY = 100
export const DEFAULT_LDC_MAX_MONTHLY = 10000
export const DEFAULT_LDC_DEFAULT_MONTHLY = 100

export type RemnawaveTier = "LV0" | "LV1" | "LV2"

export interface MonthlyLdcBounds {
    min: number
    max: number
    default: number
}

export function isRemnawaveTier(value: unknown): value is RemnawaveTier {
    return value === "LV0" || value === "LV1" || value === "LV2"
}

export function normalizeSubscriptionMonths(value: unknown) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null
    if (parsed < 1 || parsed > 12) return null
    return parsed
}

export function parsePositiveInt(raw: unknown, fallback: number): number {
    if (raw == null || raw === "") return fallback
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return fallback
    return parsed
}

export function resolveMonthlyLdcBounds(env: NodeJS.ProcessEnv = process.env): MonthlyLdcBounds {
    const min = parsePositiveInt(env.LDC_MIN_MONTHLY, DEFAULT_LDC_MIN_MONTHLY)
    const max = parsePositiveInt(env.LDC_MAX_MONTHLY, DEFAULT_LDC_MAX_MONTHLY)
    const def = parsePositiveInt(env.LDC_DEFAULT_MONTHLY, DEFAULT_LDC_DEFAULT_MONTHLY)
    const safeMax = max >= min ? max : min
    const safeDefault = Math.min(Math.max(def, min), safeMax)
    return { min, max: safeMax, default: safeDefault }
}

export function validateMonthlyLdc(value: number, bounds: MonthlyLdcBounds): boolean {
    return Number.isFinite(value) && Number.isInteger(value) && value >= bounds.min && value <= bounds.max
}

export function tierFromMonthlyLdc(
    monthlyLdc: number,
    tier1Threshold: number,
    tier2Threshold: number,
): RemnawaveTier {
    if (monthlyLdc >= tier2Threshold) return "LV2"
    if (monthlyLdc >= tier1Threshold) return "LV1"
    return "LV0"
}
