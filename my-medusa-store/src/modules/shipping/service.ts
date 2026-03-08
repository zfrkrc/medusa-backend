// ============================================================
// Medusa Turkey — ShippingModuleService
//
// Tüm kargo sağlayıcılarını yöneten merkezi servis.
// Provider'ları runtime'da register eder ve identifier ile seçer.
//
// Kullanım (medusa-config.ts):
//   {
//     resolve: "./src/modules/shipping",
//     options: {
//       default_provider: "yurtici",
//       providers: [
//         { identifier: "yurtici", options: { api_key: "...", customer_no: "..." } },
//         { identifier: "aras",    options: { username: "...", password: "..." } },
//       ]
//     }
//   }
// ============================================================

import type {
  ShippingProvider,
  ShippingModuleOptions,
  CreateShipmentInput,
  ShipmentResult,
  CancelShipmentResult,
  TrackingInfo,
  LabelResult,
  RateCalculationInput,
  RateResult,
} from "../../integrations/shipping"

export default class ShippingModuleService {
  static identifier = "shipping"

  private providers: Map<string, ShippingProvider> = new Map()
  private defaultProviderId: string | null = null

  constructor(
    _container: Record<string, unknown>,
    options?: ShippingModuleOptions
  ) {
    if (options?.default_provider) {
      this.defaultProviderId = options.default_provider
    }
    // Not: provider instance'ları dışarıdan registerProvider() ile eklenir.
    // medusa-config.ts'deki options.providers config bilgisini taşır,
    // provider oluşturma iş akışı loader/bootstrap aşamasında yapılır.
  }

  // ─── Provider Registry ───────────────────────────────────

  /**
   * Yeni bir sağlayıcı kaydeder.
   * Aynı identifier ile tekrar kaydedilirse üzerine yazar.
   */
  registerProvider(provider: ShippingProvider): void {
    this.providers.set(provider.identifier, provider)

    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.identifier
    }
  }

  /**
   * Kayıtlı sağlayıcıyı döndürür.
   * @throws identifier bulunamazsa hata fırlatır
   */
  getProvider(identifier: string): ShippingProvider {
    const provider = this.providers.get(identifier)
    if (!provider) {
      const available = Array.from(this.providers.keys()).join(", ") || "hiç yok"
      throw new Error(
        `Kargo sağlayıcısı bulunamadı: "${identifier}". ` +
        `Kayıtlı sağlayıcılar: ${available}`
      )
    }
    return provider
  }

  /**
   * Varsayılan sağlayıcıyı döndürür.
   * @throws Hiç sağlayıcı yoksa hata fırlatır
   */
  getDefaultProvider(): ShippingProvider {
    if (!this.defaultProviderId) {
      throw new Error("Hiç kargo sağlayıcısı register edilmemiş.")
    }
    return this.getProvider(this.defaultProviderId)
  }

  /**
   * Varsayılan sağlayıcıyı değiştirir.
   */
  setDefaultProvider(identifier: string): void {
    this.getProvider(identifier) // var mı kontrol et
    this.defaultProviderId = identifier
  }

  /**
   * Kayıtlı tüm sağlayıcı identifier'larını listeler.
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Sağlayıcının kayıtlı olup olmadığını kontrol eder.
   */
  hasProvider(identifier: string): boolean {
    return this.providers.has(identifier)
  }

  // ─── Gönderi İşlemleri ───────────────────────────────────

  /**
   * Belirtilen sağlayıcı ile yeni gönderi oluşturur.
   * provider belirtilmezse varsayılan kullanılır.
   */
  async createShipment(
    input: CreateShipmentInput,
    providerIdentifier?: string
  ): Promise<ShipmentResult> {
    const provider = providerIdentifier
      ? this.getProvider(providerIdentifier)
      : this.getDefaultProvider()
    return provider.createShipment(input)
  }

  /**
   * Gönderiyi iptal eder.
   */
  async cancelShipment(
    shipmentId: string,
    providerIdentifier?: string
  ): Promise<CancelShipmentResult> {
    const provider = providerIdentifier
      ? this.getProvider(providerIdentifier)
      : this.getDefaultProvider()
    return provider.cancelShipment(shipmentId)
  }

  /**
   * Takip bilgisini getirir.
   */
  async getTracking(
    trackingNumber: string,
    providerIdentifier?: string
  ): Promise<TrackingInfo> {
    const provider = providerIdentifier
      ? this.getProvider(providerIdentifier)
      : this.getDefaultProvider()
    return provider.getTracking(trackingNumber)
  }

  /**
   * Kargo etiketi oluşturur / getirir.
   */
  async createLabel(
    shipmentId: string,
    providerIdentifier?: string
  ): Promise<LabelResult> {
    const provider = providerIdentifier
      ? this.getProvider(providerIdentifier)
      : this.getDefaultProvider()
    return provider.createLabel(shipmentId)
  }

  /**
   * Tüm kayıtlı sağlayıcılardan fiyat hesaplar.
   * calculateRate desteklemeyen sağlayıcılar atlanır.
   * Sonuçlar fiyata göre artan sırada döner.
   */
  async calculateRates(input: RateCalculationInput): Promise<RateResult[]> {
    const results: RateResult[] = []

    await Promise.allSettled(
      Array.from(this.providers.values()).map(async (provider) => {
        if (typeof provider.calculateRate !== "function") return
        try {
          const rates = await provider.calculateRate(input)
          results.push(...rates)
        } catch (err) {
          console.error(
            `[shipping] ${provider.identifier} fiyat hesaplama hatası:`,
            err
          )
        }
      })
    )

    return results.sort((a, b) => a.rate - b.rate)
  }

  /**
   * Belirli bir sağlayıcıdan fiyat hesaplar.
   */
  async calculateRate(
    input: RateCalculationInput,
    providerIdentifier: string
  ): Promise<RateResult[]> {
    const provider = this.getProvider(providerIdentifier)
    if (typeof provider.calculateRate !== "function") {
      throw new Error(
        `${providerIdentifier}: calculateRate desteklenmiyor.`
      )
    }
    return provider.calculateRate(input)
  }
}
