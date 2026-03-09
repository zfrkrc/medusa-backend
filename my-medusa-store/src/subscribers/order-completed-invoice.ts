// ============================================================
// Sipariş Tamamlandı → Fatura Oluştur
//
// order.completed eventini dinler, createInvoiceWorkflow'u tetikler.
// Env: INVOICE_PROVIDER (varsayılan: "parasut"), INVOICE_TYPE
// ============================================================

import { type SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa"
import { createInvoiceWorkflow } from "../workflows/create-invoice"

export default async function orderCompletedInvoiceHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  if (!orderId) return

  const provider     = process.env.INVOICE_PROVIDER
  const invoiceType  = (process.env.INVOICE_TYPE ?? "earchive") as "earchive" | "einvoice"

  // Provider tanımlanmamışsa fatura oluşturma
  if (!provider) {
    console.log(`[invoice] INVOICE_PROVIDER tanımlı değil, sipariş ${orderId} için fatura atlandı.`)
    return
  }

  try {
    await createInvoiceWorkflow(container).run({
      input: {
        order_id:     orderId,
        provider,
        invoice_type: invoiceType,
      },
    })

    console.log(`[invoice] Sipariş ${orderId} için fatura oluşturuldu.`)
  } catch (err) {
    // Fatura hatası siparişi engellemez — sadece logla
    console.error(`[invoice] Sipariş ${orderId} fatura hatası:`, (err as Error).message)
  }
}

export const config: SubscriberConfig = {
  event: "order.completed",
}
