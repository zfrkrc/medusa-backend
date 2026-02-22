import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixSalesCents({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const pricingModuleService = container.resolve(Modules.PRICING)

    logger.info("İndirimli fiyatlar (Price Lists) kuruş formatına çevriliyor...")

    const priceLists = await pricingModuleService.listPriceLists({}, { relations: ["prices"] })

    for (const pl of priceLists) {
        const updates = []
        for (const price of pl.prices || []) {
            const amount = Number(price.amount)
            if (amount < 10000) { // Eğer 100 TL'den küçükse muhtemelen Lira formatındadır
                updates.push({
                    id: price.id,
                    amount: amount * 100
                })
            }
        }

        if (updates.length > 0) {
            // Price List içindeki fiyatları güncellemek için upsertPriceSets değil, doğrudan price list price'larını etkileyecek bir yol lazım.
            // Medusa v2'de PriceList içindeki fiyatları update etmek için:
            await pricingModuleService.updatePriceLists([{
                id: pl.id,
                prices: updates
            }])
            logger.info(`${pl.title} listesinde ${updates.length} fiyat düzeltildi.`)
        }
    }

    logger.info("🎉 Tüm indirimler kuruş formatına çekildi.")
}
