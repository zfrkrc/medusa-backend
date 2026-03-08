// ============================================================
// Medusa Turkey — Base Shipping Provider
//
// Her kargo entegrasyonu bu sınıfı extend eder.
// Ortak yardımcı metodlar burada merkezileştirilir.
//
// Kullanım:
//   class YurticiProvider extends BaseShippingProvider { ... }
// ============================================================

import type {
  ShippingProvider,
  CreateShipmentInput,
  ShipmentResult,
  CancelShipmentResult,
  TrackingInfo,
  TrackingStatus,
  LabelResult,
  RateCalculationInput,
  RateResult,
  ShippingPackage,
} from "./types"

export abstract class BaseShippingProvider implements ShippingProvider {
  abstract readonly identifier: string

  // ─── Zorunlu metodlar (her provider implemente etmeli) ───

  abstract createShipment(input: CreateShipmentInput): Promise<ShipmentResult>
  abstract cancelShipment(shipmentId: string): Promise<CancelShipmentResult>
  abstract getTracking(trackingNumber: string): Promise<TrackingInfo>
  abstract createLabel(shipmentId: string): Promise<LabelResult>

  // ─── Opsiyonel ───────────────────────────────────────────

  async calculateRate(_input: RateCalculationInput): Promise<RateResult[]> {
    throw new Error(`${this.identifier}: calculateRate desteklenmiyor.`)
  }

  // ─── Yardımcı metodlar ───────────────────────────────────

  /**
   * Desi hesaplama — Türk kargo standartı: (en × boy × yükseklik) / 3000
   * Sonuç, gerçek ağırlıktan büyükse desi kullanılır.
   */
  protected calculateDesi(pkg: ShippingPackage): number {
    if (pkg.desi) return pkg.desi
    if (pkg.width && pkg.height && pkg.length) {
      return (pkg.width * pkg.height * pkg.length) / 3000
    }
    return pkg.weight
  }

  /**
   * Faturalanabilir ağırlık — desi ve gerçek ağırlığın büyüğü.
   */
  protected getBillableWeight(pkg: ShippingPackage): number {
    const desi = this.calculateDesi(pkg)
    return Math.max(pkg.weight, desi)
  }

  /**
   * Toplam faturalanabilir ağırlık (çok kolili gönderiler için).
   */
  protected getTotalBillableWeight(packages: ShippingPackage[]): number {
    return packages.reduce((sum, pkg) => sum + this.getBillableWeight(pkg), 0)
  }

  /**
   * Türk telefon numarasını normalize eder.
   * "0532 123 45 67" → "05321234567"
   * "+90 532 123 45 67" → "05321234567"
   */
  protected normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "")
    if (digits.startsWith("90") && digits.length === 12) {
      return "0" + digits.slice(2)
    }
    if (digits.startsWith("0") && digits.length === 11) {
      return digits
    }
    if (digits.length === 10) {
      return "0" + digits
    }
    return digits
  }

  /**
   * Takip durumunu standart TrackingStatus enum'una çevirir.
   * Her sağlayıcı kendi durum kodlarını buraya map eder.
   */
  protected abstract mapTrackingStatus(providerStatus: string): TrackingStatus

  /**
   * Sağlayıcıya HTTP isteği atmak için temel fetch wrapper.
   * Her provider kendi auth header'larını inject eder.
   */
  protected async request<T>(
    url: string,
    options: RequestInit & { headers?: Record<string, string> }
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(
        `${this.identifier} API hatası: ${response.status} ${response.statusText} — ${body}`
      )
    }

    return response.json() as Promise<T>
  }
}
