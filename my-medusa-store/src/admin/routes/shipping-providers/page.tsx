// ============================================================
// Admin — Kargo Sağlayıcıları Sayfası
// URL: /app/shipping-providers
//
// Kayıtlı kargo sağlayıcılarını gösterir.
// Varsayılan sağlayıcıyı değiştirme imkanı sunar.
// ============================================================

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useState, useEffect, useCallback } from "react"

interface Provider {
  id: string
  is_default: boolean
}

const PROVIDER_LABELS: Record<string, { name: string; description: string }> = {
  yurtici:  { name: "Yurtiçi Kargo",  description: "Türkiye'nin en büyük kargo ağı." },
  aras:     { name: "Aras Kargo",     description: "Geniş ağ, API entegrasyonu." },
  mng:      { name: "MNG Kargo",      description: "Kurumsal kargo çözümleri." },
  hepsijet: { name: "HepsiJet",       description: "Hepsiburada'nın hızlı teslimat ağı." },
  ups:      { name: "UPS Türkiye",    description: "Uluslararası ve yurt içi kargo." },
}

const ShippingProvidersPage = () => {
  const backendUrl = (window as any).__MEDUSA_BACKEND_URL__ || ""

  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`${backendUrl}/admin/shipping/providers`, { credentials: "include" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setProviders(json.providers ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const setDefault = async (id: string) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${backendUrl}/admin/shipping/providers`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ default_provider: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSuccess(`Varsayılan sağlayıcı "${id}" olarak ayarlandı.`)
      fetchProviders()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px", color: "#111827" }}>
        Kargo Sağlayıcıları
      </h1>
      <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "24px" }}>
        Kayıtlı kargo sağlayıcıları ve varsayılan seçim.
        Yeni sağlayıcı eklemek için <code>medusa-config.ts</code> dosyasını düzenleyin.
      </p>

      {error   && <div style={alertStyle("#fee2e2", "#991b1b")}>{error}</div>}
      {success && <div style={alertStyle("#d1fae5", "#065f46")}>{success}</div>}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Yükleniyor…</p>
      ) : providers.length === 0 ? (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "32px", textAlign: "center" }}>
          <p style={{ color: "#6b7280", marginBottom: "8px" }}>Kayıtlı kargo sağlayıcısı yok.</p>
          <p style={{ color: "#9ca3af", fontSize: "12px" }}>
            Sağlayıcı eklemek için <code>src/integrations/shipping/</code> altında
            ilgili provider'ı implement edin ve <code>medusa-config.ts</code>'e ekleyin.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {providers.map((p) => {
            const meta = PROVIDER_LABELS[p.id] ?? { name: p.id, description: "" }
            return (
              <div
                key={p.id}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  padding:      "16px",
                  background:   p.is_default ? "#eff6ff" : "#fff",
                  border:       `1px solid ${p.is_default ? "#bfdbfe" : "#e5e7eb"}`,
                  borderRadius: "8px",
                  gap:          "16px",
                }}
              >
                {/* İkon */}
                <div style={{
                  width: "40px", height: "40px", borderRadius: "8px",
                  background: p.is_default ? "#3b82f6" : "#e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: p.is_default ? "#fff" : "#6b7280", fontSize: "18px", flexShrink: 0,
                }}>
                  📦
                </div>
                {/* Bilgi */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>
                    {meta.name}
                    {p.is_default && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", background: "#bfdbfe", color: "#1e40af", padding: "2px 8px", borderRadius: "999px" }}>
                        Varsayılan
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                    {meta.description || `Provider ID: ${p.id}`}
                  </div>
                </div>
                {/* Buton */}
                {!p.is_default && (
                  <button
                    onClick={() => setDefault(p.id)}
                    disabled={saving}
                    style={{
                      padding: "7px 14px", background: "#3b82f6", color: "#fff",
                      border: "none", borderRadius: "6px", fontSize: "12px",
                      cursor: saving ? "default" : "pointer", flexShrink: 0,
                    }}
                  >
                    {saving ? "…" : "Varsayılan Yap"}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bilgi kutusu */}
      <div style={{ marginTop: "32px", padding: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
        <h4 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#374151" }}>
          Yeni Sağlayıcı Nasıl Eklenir?
        </h4>
        <ol style={{ fontSize: "12px", color: "#6b7280", paddingLeft: "16px", margin: 0, lineHeight: "1.8" }}>
          <li><code>src/integrations/shipping/[provider]/provider.ts</code> oluştur</li>
          <li><code>BaseShippingProvider</code>'ı extend et</li>
          <li><code>medusa-config.ts</code>'teki <code>shipping.options.providers</code> dizisine ekle</li>
          <li>Backend'i yeniden başlat</li>
        </ol>
      </div>
    </div>
  )
}

function alertStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: "10px 14px", background: bg, color,
    borderRadius: "6px", fontSize: "13px", marginBottom: "16px",
  }
}

export const config = defineRouteConfig({
  label: "Kargo Sağlayıcıları",
})

export default ShippingProvidersPage
