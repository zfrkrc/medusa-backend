// ============================================================
// Sipariş Detay Sayfası — Fatura Widget'ı
// Zone: order.details.after
//
// Siparişe ait faturaları listeler.
// Fatura oluşturma ve PDF indirme butonları sunar.
// ============================================================

import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useState, useEffect, useCallback } from "react"

// ─── Tipler ────────────────────────────────────────────────

interface Invoice {
  id: string
  order_id: string
  provider: string
  provider_invoice_id: string | null
  invoice_number: string | null
  invoice_type: "earchive" | "einvoice"
  status: "draft" | "issued" | "cancelled"
  amount: number | null
  currency: string | null
  pdf_url: string | null
  issued_at: string | null
  created_at: string
}

interface OrderInvoiceWidgetProps {
  data: { id: string }
}

// ─── Yardımcı ─────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft:     "Taslak",
  issued:    "Kesildi",
  cancelled: "İptal",
}

const STATUS_COLOR: Record<string, string> = {
  draft:     "#92400e",
  issued:    "#065f46",
  cancelled: "#991b1b",
}

const STATUS_BG: Record<string, string> = {
  draft:     "#fef3c7",
  issued:    "#d1fae5",
  cancelled: "#fee2e2",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("tr-TR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  })
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "—"
  const curr = currency?.toUpperCase() ?? "TRY"
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: curr }).format(amount / 100)
}

// ─── Widget ────────────────────────────────────────────────

const OrderInvoiceWidget = ({ data }: OrderInvoiceWidgetProps) => {
  const orderId = data.id
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  const backendUrl = (window as any).__MEDUSA_BACKEND_URL__ || ""

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${backendUrl}/admin/invoices?order_id=${orderId}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setInvoices(json.invoices ?? [])
    } catch (e) {
      setError("Faturalar yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [orderId, backendUrl])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const createInvoice = async (type: "earchive" | "einvoice") => {
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${backendUrl}/admin/invoices`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ order_id: orderId, invoice_type: type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSuccess(`Fatura oluşturuldu: ${json.invoice?.invoice_number ?? ""}`)
      fetchInvoices()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const downloadPdf = (inv: Invoice) => {
    if (inv.pdf_url) {
      window.open(inv.pdf_url, "_blank")
    } else {
      window.open(`${backendUrl}/admin/invoices/${inv.id}/pdf`, "_blank")
    }
  }

  const cancelInvoice = async (id: string) => {
    if (!confirm("Bu faturayı iptal etmek istediğinizden emin misiniz?")) return
    try {
      await fetch(`${backendUrl}/admin/invoices/${id}`, {
        method:      "DELETE",
        credentials: "include",
      })
      fetchInvoices()
    } catch {
      setError("İptal başarısız.")
    }
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", marginTop: "16px" }}>
      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#111827" }}>
          e-Fatura / e-Arşiv
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => createInvoice("earchive")}
            disabled={creating}
            style={btnStyle("#3b82f6")}
          >
            {creating ? "Oluşturuluyor…" : "+ e-Arşiv"}
          </button>
          <button
            onClick={() => createInvoice("einvoice")}
            disabled={creating}
            style={btnStyle("#8b5cf6")}
          >
            {creating ? "…" : "+ e-Fatura"}
          </button>
        </div>
      </div>

      {/* Mesajlar */}
      {error   && <div style={alertStyle("#fee2e2", "#991b1b")}>{error}</div>}
      {success && <div style={alertStyle("#d1fae5", "#065f46")}>{success}</div>}

      {/* Liste */}
      {loading ? (
        <p style={{ color: "#6b7280", fontSize: "13px" }}>Yükleniyor…</p>
      ) : invoices.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: "13px" }}>Bu siparişe ait fatura yok.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              {["Fatura No", "Tür", "Tutar", "Tarih", "Durum", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px" }}>{inv.invoice_number ?? "—"}</td>
                <td style={{ padding: "8px" }}>{inv.invoice_type === "einvoice" ? "e-Fatura" : "e-Arşiv"}</td>
                <td style={{ padding: "8px" }}>{formatAmount(inv.amount, inv.currency)}</td>
                <td style={{ padding: "8px" }}>{formatDate(inv.issued_at ?? inv.created_at)}</td>
                <td style={{ padding: "8px" }}>
                  <span style={{
                    padding:      "2px 8px",
                    borderRadius: "999px",
                    fontSize:     "11px",
                    fontWeight:   600,
                    background:   STATUS_BG[inv.status] ?? "#f3f4f6",
                    color:        STATUS_COLOR[inv.status] ?? "#374151",
                  }}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </td>
                <td style={{ padding: "8px", display: "flex", gap: "4px" }}>
                  {inv.status !== "cancelled" && (
                    <>
                      <button onClick={() => downloadPdf(inv)} style={smallBtnStyle("#3b82f6")}>PDF</button>
                      <button onClick={() => cancelInvoice(inv.id)} style={smallBtnStyle("#ef4444")}>İptal</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Style Yardımcıları ────────────────────────────────────

function btnStyle(color: string): React.CSSProperties {
  return {
    padding:      "6px 12px",
    background:   color,
    color:        "#fff",
    border:       "none",
    borderRadius: "6px",
    fontSize:     "12px",
    fontWeight:   500,
    cursor:       "pointer",
  }
}

function smallBtnStyle(color: string): React.CSSProperties {
  return {
    padding:      "3px 8px",
    background:   color,
    color:        "#fff",
    border:       "none",
    borderRadius: "4px",
    fontSize:     "11px",
    cursor:       "pointer",
  }
}

function alertStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding:      "8px 12px",
    background:   bg,
    color,
    borderRadius: "6px",
    fontSize:     "12px",
    marginBottom: "8px",
  }
}

// ─── Config ────────────────────────────────────────────────

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderInvoiceWidget
