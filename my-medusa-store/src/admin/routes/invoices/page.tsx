// ============================================================
// Admin — Faturalar Sayfası
// URL: /app/invoices
//
// Tüm faturaları listeler. Filtre, PDF indirme, iptal.
// defineRouteConfig ile sol menüye "Faturalar" linki eklenir.
// ============================================================

import { defineRouteConfig } from "@medusajs/admin-sdk"
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

// ─── Yardımcılar ───────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak", issued: "Kesildi", cancelled: "İptal",
}
const STATUS_BG:    Record<string, string> = {
  draft: "#fef3c7", issued: "#d1fae5", cancelled: "#fee2e2",
}
const STATUS_COLOR: Record<string, string> = {
  draft: "#92400e", issued: "#065f46", cancelled: "#991b1b",
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("tr-TR")
}

function fmtAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("tr-TR", {
    style:    "currency",
    currency: currency?.toUpperCase() ?? "TRY",
  }).format(amount / 100)
}

// ─── Sayfa ─────────────────────────────────────────────────

const InvoicesPage = () => {
  const backendUrl = (window as any).__MEDUSA_BACKEND_URL__ || ""

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [page, setPage]         = useState(0)

  const [filterStatus,  setFilterStatus]  = useState("")
  const [filterOrderId, setFilterOrderId] = useState("")

  const limit = 20

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      limit:  String(limit),
      offset: String(page * limit),
    })
    if (filterStatus)  params.set("status",   filterStatus)
    if (filterOrderId) params.set("order_id", filterOrderId.trim())

    try {
      const res  = await fetch(`${backendUrl}/admin/invoices?${params}`, { credentials: "include" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setInvoices(json.invoices ?? [])
      setTotal(json.count ?? 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [backendUrl, page, filterStatus, filterOrderId])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const downloadPdf = (inv: Invoice) => {
    const url = inv.pdf_url ?? `${backendUrl}/admin/invoices/${inv.id}/pdf`
    window.open(url, "_blank")
  }

  const cancelInvoice = async (id: string) => {
    if (!confirm("Bu faturayı iptal etmek istediğinizden emin misiniz?")) return
    await fetch(`${backendUrl}/admin/invoices/${id}`, {
      method: "DELETE", credentials: "include",
    })
    fetchInvoices()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px", color: "#111827" }}>
        e-Fatura / e-Arşiv Yönetimi
      </h1>

      {/* Filtreler */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          placeholder="Sipariş ID..."
          value={filterOrderId}
          onChange={(e) => { setFilterOrderId(e.target.value); setPage(0) }}
          style={inputStyle}
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(0) }}
          style={inputStyle}
        >
          <option value="">Tüm Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="issued">Kesildi</option>
          <option value="cancelled">İptal</option>
        </select>
        <button onClick={fetchInvoices} style={btnBlue}>Yenile</button>
      </div>

      {/* Hata */}
      {error && (
        <div style={{ padding: "10px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "12px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Tablo */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
        {loading ? (
          <p style={{ padding: "24px", color: "#6b7280", textAlign: "center" }}>Yükleniyor…</p>
        ) : invoices.length === 0 ? (
          <p style={{ padding: "24px", color: "#9ca3af", textAlign: "center" }}>Fatura bulunamadı.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                {["Fatura No", "Sipariş ID", "Tür", "Sağlayıcı", "Tutar", "Tarih", "Durum", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "#6b7280", fontWeight: 500, borderBottom: "1px solid #e5e7eb" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={tdStyle}>{inv.invoice_number ?? "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "11px", color: "#6b7280" }}>
                    {inv.order_id.slice(0, 12)}…
                  </td>
                  <td style={tdStyle}>{inv.invoice_type === "einvoice" ? "e-Fatura" : "e-Arşiv"}</td>
                  <td style={tdStyle}>{inv.provider}</td>
                  <td style={tdStyle}>{fmtAmount(inv.amount, inv.currency)}</td>
                  <td style={tdStyle}>{fmtDate(inv.issued_at ?? inv.created_at)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600,
                      background: STATUS_BG[inv.status]    ?? "#f3f4f6",
                      color:      STATUS_COLOR[inv.status] ?? "#374151",
                    }}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, display: "flex", gap: "4px" }}>
                    {inv.status !== "cancelled" && (
                      <>
                        <button onClick={() => downloadPdf(inv)} style={smallBtn("#3b82f6")}>PDF</button>
                        <button onClick={() => cancelInvoice(inv.id)} style={smallBtn("#ef4444")}>İptal</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={pageBtnStyle(page === 0)}>
            ← Önceki
          </button>
          <span style={{ padding: "6px 12px", fontSize: "13px", color: "#374151" }}>
            {page + 1} / {totalPages}  ({total} kayıt)
          </span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={pageBtnStyle(page >= totalPages - 1)}>
            Sonraki →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Stiller ───────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: "6px",
  fontSize: "13px", color: "#374151", background: "#fff", minWidth: "180px",
}
const btnBlue: React.CSSProperties = {
  padding: "7px 14px", background: "#3b82f6", color: "#fff",
  border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
}
const tdStyle: React.CSSProperties = { padding: "10px 12px" }

function smallBtn(color: string): React.CSSProperties {
  return {
    padding: "3px 8px", background: color, color: "#fff",
    border: "none", borderRadius: "4px", fontSize: "11px", cursor: "pointer",
  }
}
function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", background: disabled ? "#f3f4f6" : "#3b82f6",
    color: disabled ? "#9ca3af" : "#fff", border: "none", borderRadius: "6px",
    fontSize: "13px", cursor: disabled ? "default" : "pointer",
  }
}

// ─── Config ────────────────────────────────────────────────

export const config = defineRouteConfig({
  label: "Faturalar",
})

export default InvoicesPage
