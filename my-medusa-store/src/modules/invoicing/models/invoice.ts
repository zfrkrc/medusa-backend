import { model } from "@medusajs/framework/utils"

const Invoice = model.define("invoice", {
  id:                   model.id().primaryKey(),
  order_id:             model.text(),
  provider:             model.text(),              // "parasut" | ...
  provider_invoice_id:  model.text().nullable(),   // Paraşüt sales_invoice id
  invoice_number:       model.text().nullable(),   // Fatura no (ör. "A-00001")
  invoice_type:         model.text(),              // "earchive" | "einvoice"
  status:               model.text(),              // "draft" | "issued" | "cancelled"
  amount:               model.bigNumber().nullable(),
  currency:             model.text().nullable(),
  pdf_url:              model.text().nullable(),
  issued_at:            model.dateTime().nullable(),
  error_message:        model.text().nullable(),
})

export default Invoice
