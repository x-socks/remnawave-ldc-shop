'use client'

import { useMemo, useRef, useState, type FormEvent } from "react"
import { CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createRemnawavePaymentOrder } from "@/actions/remnawave-payment"
import {
    normalizeSubscriptionMonths,
    tierFromMonthlyLdc,
    validateMonthlyLdc,
    type MonthlyLdcBounds,
} from "@/lib/remnawave-subscription"
import { useI18n } from "@/lib/i18n/context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RemnawaveProduct {
    id: string
    name: string
    description: string | null
}

interface RemnawaveSubscriptionFormProps {
    product: RemnawaveProduct
    bounds: MonthlyLdcBounds
    tier1Threshold: number
    tier2Threshold: number
}

const UNIT_STEP = 100

function isMultipleOfStep(value: number) {
    return Number.isFinite(value) && Number.isInteger(value) && value % UNIT_STEP === 0
}

export function RemnawaveSubscriptionForm({
    product,
    bounds,
    tier1Threshold,
    tier2Threshold,
}: RemnawaveSubscriptionFormProps) {
    const { t } = useI18n()

    // If env-configured bounds aren't all multiples of 100, fall back to raw LDC
    // input. Defensive only — default config (100/100/10000) is always aligned.
    const useUnitInput =
        isMultipleOfStep(bounds.min) &&
        isMultipleOfStep(bounds.max) &&
        isMultipleOfStep(bounds.default)

    const unitsMin = useUnitInput ? bounds.min / UNIT_STEP : bounds.min
    const unitsMax = useUnitInput ? bounds.max / UNIT_STEP : bounds.max
    const unitsDefault = useUnitInput
        ? Math.round(bounds.default / UNIT_STEP)
        : bounds.default

    const [unitsInput, setUnitsInput] = useState(String(unitsDefault))
    const [monthsInput, setMonthsInput] = useState("1")
    const [submitting, setSubmitting] = useState(false)
    const isNavigatingRef = useRef(false)

    const months = normalizeSubscriptionMonths(Number(monthsInput))

    const parsedUnits = useMemo(() => {
        if (unitsInput === "") return null
        const n = Number(unitsInput)
        if (!Number.isFinite(n)) return null
        return n
    }, [unitsInput])

    // Convert input → raw monthly_ldc (LDC). For the unit input model the
    // input is in 100-LDC units; for the fallback raw model it is direct LDC.
    const rawMonthlyLdc = useMemo(() => {
        if (parsedUnits == null) return null
        return useUnitInput ? parsedUnits * UNIT_STEP : parsedUnits
    }, [parsedUnits, useUnitInput])

    const monthlyLdcValid =
        rawMonthlyLdc != null && validateMonthlyLdc(rawMonthlyLdc, bounds)
    const monthlyLdcForCompute = monthlyLdcValid ? (rawMonthlyLdc as number) : 0

    const tier = useMemo(
        () => tierFromMonthlyLdc(monthlyLdcForCompute, tier1Threshold, tier2Threshold),
        [monthlyLdcForCompute, tier1Threshold, tier2Threshold],
    )

    const total = useMemo(
        () => (months && monthlyLdcValid ? monthlyLdcForCompute * months : 0),
        [monthlyLdcForCompute, months, monthlyLdcValid],
    )

    const monthlyLdcErrorMessage = (() => {
        if (parsedUnits == null) {
            return useUnitInput
                ? t("remnawave.monthlyLdcErrorRange", { min: unitsMin, max: unitsMax })
                : t("remnawave.monthlyLdcErrorRawRange", { min: bounds.min, max: bounds.max })
        }
        if (!Number.isInteger(parsedUnits)) {
            return useUnitInput
                ? t("remnawave.monthlyLdcErrorInteger")
                : t("remnawave.monthlyLdcErrorInteger")
        }
        if (useUnitInput) {
            if (parsedUnits < unitsMin || parsedUnits > unitsMax) {
                return t("remnawave.monthlyLdcErrorRange", { min: unitsMin, max: unitsMax })
            }
        } else {
            if (rawMonthlyLdc == null || rawMonthlyLdc < bounds.min || rawMonthlyLdc > bounds.max) {
                return t("remnawave.monthlyLdcErrorRawRange", { min: bounds.min, max: bounds.max })
            }
        }
        return null
    })()

    const submitPaymentForm = (url: string, params: Record<string, unknown>) => {
        const form = document.createElement("form")
        form.method = "POST"
        // Route through the same-origin /paying redirector (matches the
        // working buy-button + payment-link-content flow). This avoids the
        // brief "page couldn't load" overlay caused by a cross-origin POST
        // racing with a React re-render.
        form.action = "/paying"
        form.target = "_top"

        const allParams: Record<string, unknown> = { ...params, url }
        Object.entries(allParams).forEach(([key, value]) => {
            const input = document.createElement("input")
            input.type = "hidden"
            input.name = key
            input.value = String(value)
            form.appendChild(input)
        })

        document.body.appendChild(form)
        form.submit()
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (isNavigatingRef.current) return

        if (!months) {
            toast.error(t("remnawave.errorMonthsRange"))
            return
        }
        if (!monthlyLdcValid || rawMonthlyLdc == null) {
            toast.error(monthlyLdcErrorMessage || t("remnawave.errorInvalidMonthly"))
            return
        }

        setSubmitting(true)
        try {
            const result = await createRemnawavePaymentOrder({
                productId: product.id,
                tier,
                months,
                monthlyLdc: rawMonthlyLdc,
            })

            if (!result?.success || !result.url || !result.params) {
                toast.error(result?.error || t("remnawave.errorCouldNotStart"))
                if (!isNavigatingRef.current) setSubmitting(false)
                return
            }

            // From here on we are about to navigate. Suppress any further
            // React state updates so the unmount doesn't render the global
            // "page couldn't load" toast/overlay.
            isNavigatingRef.current = true
            submitPaymentForm(result.url, result.params)
            // Intentionally do NOT setSubmitting(false) — the page is
            // navigating away. Touching state here causes the flash.
        } catch (error: any) {
            if (!isNavigatingRef.current) {
                toast.error(error?.message || t("remnawave.errorCouldNotStart"))
                setSubmitting(false)
            }
        }
    }

    const canSubmit = !submitting && !!months && monthlyLdcValid && total > 0

    const breakdownKey =
        months === 1 ? "remnawave.computedPriceBreakdown" : "remnawave.computedPriceBreakdownPlural"

    return (
        <main className="container py-8 md:py-16">
            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <section className="space-y-4">
                    <div className="rounded-xl border border-border/30 bg-card/70 p-6 shadow-sm">
                        <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {t("remnawave.vpnLabel")}
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                                {product.name}
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                                {product.description || t("remnawave.fallbackDescription")}
                            </p>
                        </div>
                    </div>
                </section>

                <Card className="h-fit border-border/35">
                    <CardHeader>
                        <CardTitle>{t("remnawave.subscriptionTitle")}</CardTitle>
                        <CardDescription>{t("remnawave.subscriptionDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="remnawave-monthly-ldc">
                                        {t("remnawave.monthlyLdcLabel")}
                                    </Label>
                                    <Badge variant="secondary" className="rounded-full text-[10px] font-medium">
                                        {t("remnawave.tierBadge", { tier })}
                                    </Badge>
                                </div>
                                <Input
                                    id="remnawave-monthly-ldc"
                                    type="number"
                                    inputMode="numeric"
                                    min={unitsMin}
                                    max={unitsMax}
                                    step={1}
                                    value={unitsInput}
                                    onChange={(event) => setUnitsInput(event.target.value)}
                                    disabled={submitting}
                                    aria-invalid={!monthlyLdcValid}
                                />
                                {useUnitInput ? (
                                    <p className="text-xs text-muted-foreground">
                                        {t("remnawave.monthlyLdcHelper", {
                                            units: parsedUnits != null && Number.isFinite(parsedUnits) ? parsedUnits : 0,
                                            total: monthlyLdcValid ? monthlyLdcForCompute : 0,
                                        })}
                                    </p>
                                ) : null}
                                <p className="text-xs text-muted-foreground">
                                    {useUnitInput
                                        ? t("remnawave.monthlyLdcRangeHelper", { min: unitsMin, max: unitsMax })
                                        : t("remnawave.monthlyLdcAdvancedHelper", {
                                              min: bounds.min,
                                              max: bounds.max,
                                          })}
                                </p>
                                {!monthlyLdcValid && unitsInput !== "" && monthlyLdcErrorMessage && (
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        {monthlyLdcErrorMessage}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="remnawave-months">{t("remnawave.monthsLabel")}</Label>
                                <Input
                                    id="remnawave-months"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={12}
                                    step={1}
                                    value={monthsInput}
                                    onChange={(event) => setMonthsInput(event.target.value)}
                                    disabled={submitting}
                                />
                            </div>

                            <div className="rounded-lg border border-border/35 bg-muted/20 p-4">
                                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    {t("remnawave.computedPriceLabel")}
                                </div>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-semibold tabular-nums text-primary">
                                        {total}
                                    </span>
                                    <span className="text-sm font-medium text-muted-foreground">LDC</span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {t(breakdownKey, {
                                        monthlyLdc: monthlyLdcValid ? monthlyLdcForCompute : 0,
                                        months: months || 0,
                                    })}
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={!canSubmit}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                {t("remnawave.payButton", { total })}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
