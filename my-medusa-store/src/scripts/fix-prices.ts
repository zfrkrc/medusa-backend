import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixPrices({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)

    logger.info("Fiyatlar düzeltiliyor (1000 - 3000 arası)...")

    // Mevcut tüm price setleri bulalım
    const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })

    for (const ps of priceSets) {
        const tryPrice = ps.prices?.find((p: any) => p.currency_code === "try")
        const amount = Number(tryPrice?.amount || 0)
        if (tryPrice && amount > 3000) {
            // Eğer fiyat 3000'den büyükse muhtemelen 100 ile çarpılmış halidir
            const newAmount = Math.floor(amount / 100)
            await (pricingModuleService as any).upsertPriceSets([
                {
                    id: ps.id,
                    prices: [
                        {
                            id: tryPrice.id,
                            amount: newAmount
                        }
                    ]
                }
            ])
            logger.info(`Fiyat düzeltildi: ${amount} -> ${newAmount}`)
        }
    }

    logger.info("🎉 İşlem tamamlandı.")
}
