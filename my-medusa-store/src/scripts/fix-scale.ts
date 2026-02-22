import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixPricesScale({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const pricingModuleService = container.resolve(Modules.PRICING)

    logger.info("Fiyatlar 100 kat küçültülüyor...")

    const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })
    const updates = []

    for (const ps of priceSets) {
        const tryPrice = ps.prices?.find(p => p.currency_code === "try")
        if (tryPrice && tryPrice.amount > 3000) {
            updates.push({
                id: ps.id,
                prices: [{ id: tryPrice.id, amount: Math.floor(tryPrice.amount / 100) }]
            })
        }
    }

    if (updates.length > 0) {
        await pricingModuleService.updatePriceSets(updates)
        logger.info(`${updates.length} fiyat düzeltildi.`)
    }

    logger.info("🎉 Bitti.")
}
