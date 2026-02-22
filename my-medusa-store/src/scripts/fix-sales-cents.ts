export default async function fixSalesCents({ container }) {
    const logger = container.resolve("logger")
    const pricingModuleService = container.resolve("pricingModuleService")

    logger.info("İndirimli fiyatlar kuruş formatına çevriliyor...")

    const priceLists = await pricingModuleService.listPriceLists({}, { relations: ["prices"] })

    for (const pl of priceLists) {
        const updates = []
        for (const price of pl.prices || []) {
            const amount = Number(price.amount)
            if (amount < 10000) {
                updates.push({
                    id: price.id,
                    amount: amount * 100
                })
            }
        }

        if (updates.length > 0) {
            await pricingModuleService.updatePrices(updates)
            logger.info(`${pl.title} listesinde ${updates.length} fiyat düzeltildi.`)
        }
    }

    logger.info("🎉 İşlem tamam.")
}
