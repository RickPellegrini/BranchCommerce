"use client"

import Script from "next/script"
import { useMemo, useRef, useState } from "react"
import { CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type CardFormData = {
  token: string
  paymentMethodId?: string
  payment_method_id?: string
  issuerId?: string
  issuer_id?: string
  installments: string
  cardholderEmail?: string
  identificationType?: string
  identificationNumber?: string
  payer?: {
    email: string
    identification: {
      type: string
      number: string
    }
  }
}

type MercadoPagoInstance = {
  cardForm: (options: {
    amount: string
    iframe: boolean
    form: {
      id: string
      cardNumber: { id: string; placeholder: string }
      expirationDate: { id: string; placeholder: string }
      securityCode: { id: string; placeholder: string }
      cardholderName: { id: string; placeholder: string }
      issuer: { id: string; placeholder: string }
      installments: { id: string; placeholder: string }
      identificationType: { id: string; placeholder: string }
      identificationNumber: { id: string; placeholder: string }
      cardholderEmail: { id: string; placeholder: string }
    }
    callbacks: {
      onFormMounted: (error?: unknown) => void
      onSubmit: (event: Event) => void
      onFetching: (resource: string) => void
    }
  }) => {
    getCardFormData: () => CardFormData
  }
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance
  }
}

type Props = {
  publicKey: string
}

type PaymentResult = {
  id?: number
  status?: string
  status_detail?: string
  error?: string
  details?: unknown
}

function serializeError(error: unknown): PaymentResult {
  if (error instanceof Error) {
    return { error: error.message, details: { name: error.name, stack: error.stack } }
  }
  if (typeof error === "object" && error !== null) {
    return {
      error: JSON.stringify(error),
      details: error,
    }
  }
  return { error: String(error) }
}

export function MpTestPaymentForm({ publicKey }: Props) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [fetching, setFetching] = useState<string | null>(null)
  const [qualitySecret, setQualitySecret] = useState("")
  const qualitySecretRef = useRef("")
  const canSubmit = useMemo(
    () => Boolean(mounted && publicKey && !loading),
    [mounted, publicKey, loading],
  )

  function initMercadoPago() {
    if (!window.MercadoPago || !publicKey || mounted) return

    const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" })
    const cardForm = mp.cardForm({
      amount: "10",
      iframe: true,
      form: {
        id: "mp-test-payment-form",
        cardNumber: {
          id: "form-checkout__cardNumber",
          placeholder: "5031 4332 1540 6351",
        },
        expirationDate: {
          id: "form-checkout__expirationDate",
          placeholder: "11/30",
        },
        securityCode: {
          id: "form-checkout__securityCode",
          placeholder: "123",
        },
        cardholderName: {
          id: "form-checkout__cardholderName",
          placeholder: "APRO",
        },
        issuer: {
          id: "form-checkout__issuer",
          placeholder: "Issuer",
        },
        installments: {
          id: "form-checkout__installments",
          placeholder: "Installments",
        },
        identificationType: {
          id: "form-checkout__identificationType",
          placeholder: "CPF",
        },
        identificationNumber: {
          id: "form-checkout__identificationNumber",
          placeholder: "12345678909",
        },
        cardholderEmail: {
          id: "form-checkout__cardholderEmail",
          placeholder: "buyer@example.com",
        },
      },
      callbacks: {
        onFormMounted: (error) => {
          if (error) {
            setResult(serializeError(error))
            return
          }
          setMounted(true)
        },
        onSubmit: async (event) => {
          event.preventDefault()
          setLoading(true)
          setResult(null)

          try {
            const data = cardForm.getCardFormData()
            const email = data.payer?.email ?? data.cardholderEmail
            const identificationType =
              data.payer?.identification.type ?? data.identificationType ?? "CPF"
            const identificationNumber =
              data.payer?.identification.number ?? data.identificationNumber
            const paymentMethodId = data.paymentMethodId ?? data.payment_method_id
            const issuerId = data.issuerId ?? data.issuer_id

            if (!email || !identificationNumber || !paymentMethodId || !data.token) {
              setResult({
                error: "Mercado Pago cardForm returned incomplete data.",
                details: data,
              })
              return
            }

            const currentQualitySecret =
              document.querySelector<HTMLInputElement>("#qualitySecret")?.value ?? ""

            const response = await fetch("/api/mp/test-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: data.token,
                paymentMethodId,
                issuerId,
                installments: Number(data.installments || 1),
                email,
                identificationType,
                identificationNumber,
                qualitySecret: currentQualitySecret || qualitySecretRef.current || undefined,
              }),
            })
            const payload = (await response.json()) as PaymentResult
            setResult(payload)
          } catch (error) {
            setResult(serializeError(error))
          } finally {
            setLoading(false)
            setFetching(null)
          }
        },
        onFetching: (resource) => {
          setFetching(resource)
        },
      },
    })
  }

  return (
    <>
      <Script src="https://sdk.mercadopago.com/js/v2" onLoad={initMercadoPago} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" />
            Test card payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form id="mp-test-payment-form" className="space-y-4">
            {!publicKey ? (
              <p className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                MERCADO_PAGO_PUBLIC_KEY is missing.
              </p>
            ) : null}
            {publicKey && !publicKey.startsWith("TEST-") ? (
              <p className="border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                This page is using a non-test public key. Mercado Pago's checklist payment should
                use TEST credentials.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="form-checkout__cardNumber">
                  Card number
                </label>
                <div id="form-checkout__cardNumber" className="h-8 border border-input px-2 py-1" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="form-checkout__expirationDate">
                  Expiration
                </label>
                <div
                  id="form-checkout__expirationDate"
                  className="h-8 border border-input px-2 py-1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="form-checkout__securityCode">
                  CVV
                </label>
                <div
                  id="form-checkout__securityCode"
                  className="h-8 border border-input px-2 py-1"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="form-checkout__cardholderName">
                  Cardholder
                </label>
                <Input id="form-checkout__cardholderName" defaultValue="APRO" />
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs font-medium"
                  htmlFor="form-checkout__identificationNumber"
                >
                  CPF
                </label>
                <Input id="form-checkout__identificationNumber" defaultValue="12345678909" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="form-checkout__cardholderEmail">
                  Buyer email
                </label>
                <Input id="form-checkout__cardholderEmail" type="email" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="qualitySecret">
                Quality secret
              </label>
              <Input
                id="qualitySecret"
                name="qualitySecret"
                type="password"
                value={qualitySecret}
                onChange={(event) => {
                  qualitySecretRef.current = event.target.value
                  setQualitySecret(event.target.value)
                }}
                placeholder="Required only when enabled in production"
              />
            </div>
            <div className="hidden">
              <select id="form-checkout__issuer" name="issuer" />
              <select id="form-checkout__installments" name="installments" />
              <select id="form-checkout__identificationType" name="identificationType">
                <option value="CPF">CPF</option>
              </select>
            </div>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? "Processing..." : "Pay R$ 10 test"}
            </Button>
            {fetching ? (
              <p className="text-xs text-muted-foreground">Fetching {fetching}...</p>
            ) : null}
          </form>
          {result ? (
            <pre className="mt-4 max-h-80 overflow-auto border bg-muted p-3 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}
