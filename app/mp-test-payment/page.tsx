import { getMercadoPagoConfig } from "@/lib/mercadopago/config"

import { MpTestPaymentForm } from "./test-payment-form"

export default function MpTestPaymentPage() {
  const config = getMercadoPagoConfig()

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal">Mercado Pago Quality Payment</h1>
          <p className="text-sm text-muted-foreground">
            Controlled payment page for Mercado Pago integration quality measurement.
          </p>
        </div>
        <MpTestPaymentForm publicKey={config.publicKey} />
      </div>
    </main>
  )
}
