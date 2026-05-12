'use client'

import { useMemo, useState, type FormEvent } from "react"
import { CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createRemnawavePaymentOrder } from "@/actions/remnawave-payment"
import { TIER_RATES, type RemnawaveTier, isRemnawaveTier, normalizeSubscriptionMonths } from "@/lib/remnawave-subscription"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RemnawaveProduct {
    id: string
    name: string
    description: string | null
}

export function RemnawaveSubscriptionForm({ product }: { product: RemnawaveProduct }) {
    const [tier, setTier] = useState<RemnawaveTier>("LV0")
    const [monthsInput, setMonthsInput] = useState("1")
    const [submitting, setSubmitting] = useState(false)

    const months = normalizeSubscriptionMonths(Number(monthsInput))
    const monthlyLdc = TIER_RATES[tier]
    const total = useMemo(() => (months ? monthlyLdc * months : 0), [monthlyLdc, months])

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

        if (!isRemnawaveTier(tier) || !months || monthlyLdc <= 0) {
            toast.error("Select a valid tier and 1-12 months.")
            return
        }

        setSubmitting(true)
        try {
            const result = await createRemnawavePaymentOrder({
                productId: product.id,
                tier,
                months,
                monthlyLdc,
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
                        <CardDescription>Choose a tier and subscription length.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="remnawave-tier">Tier</Label>
                                <select
                                    id="remnawave-tier"
                                    value={tier}
                                    onChange={(event) => {
                                        if (isRemnawaveTier(event.target.value)) {
                                            setTier(event.target.value)
                                        }
                                    }}
                                    disabled={submitting}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {Object.entries(TIER_RATES).map(([value, rate]) => (
                                        <option key={value} value={value}>
                                            {value} - {rate} LDC/month
                                        </option>
                                    ))}
                                </select>
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
                                    {monthlyLdc} LDC/month x {months || 0} month{months === 1 ? "" : "s"}
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={submitting || !months || total <= 0}>
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
