'use client'

import { useMemo, useState, type FormEvent } from "react"
import { CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createRemnawavePaymentOrder } from "@/actions/remnawave-payment"
import {
    normalizeSubscriptionMonths,
    tierFromMonthlyLdc,
    validateMonthlyLdc,
    type MonthlyLdcBounds,
} from "@/lib/remnawave-subscription"
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

export function RemnawaveSubscriptionForm({
    product,
    bounds,
    tier1Threshold,
    tier2Threshold,
}: RemnawaveSubscriptionFormProps) {
    const [monthlyLdcInput, setMonthlyLdcInput] = useState(String(bounds.default))
    const [monthsInput, setMonthsInput] = useState("1")
    const [submitting, setSubmitting] = useState(false)

    const months = normalizeSubscriptionMonths(Number(monthsInput))

    const parsedMonthlyLdc = useMemo(() => {
        const n = Number(monthlyLdcInput)
        if (!Number.isFinite(n)) return null
        return n
    }, [monthlyLdcInput])

    const monthlyLdcValid = parsedMonthlyLdc != null && validateMonthlyLdc(parsedMonthlyLdc, bounds)
    const monthlyLdcForCompute = monthlyLdcValid ? (parsedMonthlyLdc as number) : 0
    const tier = useMemo(
        () => tierFromMonthlyLdc(monthlyLdcForCompute, tier1Threshold, tier2Threshold),
        [monthlyLdcForCompute, tier1Threshold, tier2Threshold],
    )

    const total = useMemo(
        () => (months && monthlyLdcValid ? monthlyLdcForCompute * months : 0),
        [monthlyLdcForCompute, months, monthlyLdcValid],
    )

    const monthlyLdcErrorMessage = (() => {
        if (parsedMonthlyLdc == null) return `Enter a number between ${bounds.min} and ${bounds.max}.`
        if (!Number.isInteger(parsedMonthlyLdc)) return "Monthly LDC must be a whole number."
        if (parsedMonthlyLdc < bounds.min) return `Monthly LDC must be at least ${bounds.min}.`
        if (parsedMonthlyLdc > bounds.max) return `Monthly LDC must be at most ${bounds.max}.`
        return null
    })()

    const submitPaymentForm = (url: string, params: Record<string, unknown>) => {
        const form = document.createElement("form")
        form.method = "POST"
        form.action = url

        Object.entries(params).forEach(([key, value]) => {
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

        if (!months) {
            toast.error("Months must be an integer from 1 to 12.")
            return
        }
        if (!monthlyLdcValid || parsedMonthlyLdc == null) {
            toast.error(monthlyLdcErrorMessage || "Invalid monthly LDC amount.")
            return
        }

        setSubmitting(true)
        try {
            const result = await createRemnawavePaymentOrder({
                productId: product.id,
                tier,
                months,
                monthlyLdc: parsedMonthlyLdc,
            })

            if (!result?.success || !result.url || !result.params) {
                toast.error(result?.error || "Payment could not be started.")
                return
            }

            submitPaymentForm(result.url, result.params)
        } catch (error: any) {
            toast.error(error?.message || "Payment could not be started.")
        } finally {
            setSubmitting(false)
        }
    }

    const canSubmit = !submitting && !!months && monthlyLdcValid && total > 0

    return (
        <main className="container py-8 md:py-16">
            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <section className="space-y-4">
                    <div className="rounded-xl border border-border/30 bg-card/70 p-6 shadow-sm">
                        <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Remnawave VPN
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                                {product.name}
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                                {product.description || "Pay-as-you-go monthly Remnawave VPN subscription."}
                            </p>
                        </div>
                    </div>
                </section>

                <Card className="h-fit border-border/35">
                    <CardHeader>
                        <CardTitle>Subscription</CardTitle>
                        <CardDescription>Pick a monthly LDC amount and length.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="remnawave-monthly-ldc">Monthly LDC</Label>
                                    <Badge variant="secondary" className="rounded-full text-[10px] font-medium">
                                        Tier: {tier}
                                    </Badge>
                                </div>
                                <Input
                                    id="remnawave-monthly-ldc"
                                    type="number"
                                    inputMode="numeric"
                                    min={bounds.min}
                                    max={bounds.max}
                                    step={1}
                                    value={monthlyLdcInput}
                                    onChange={(event) => setMonthlyLdcInput(event.target.value)}
                                    disabled={submitting}
                                    aria-invalid={!monthlyLdcValid}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Allowed range: {bounds.min} - {bounds.max} LDC/month.
                                </p>
                                {!monthlyLdcValid && monthlyLdcInput !== "" && monthlyLdcErrorMessage && (
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        {monthlyLdcErrorMessage}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="remnawave-months">Months</Label>
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
                                    Computed price
                                </div>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-semibold tabular-nums text-primary">
                                        {total}
                                    </span>
                                    <span className="text-sm font-medium text-muted-foreground">LDC</span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {monthlyLdcValid ? monthlyLdcForCompute : 0} LDC/month x {months || 0} month{months === 1 ? "" : "s"}
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={!canSubmit}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                Pay {total} LDC via Linux DO Credit
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
