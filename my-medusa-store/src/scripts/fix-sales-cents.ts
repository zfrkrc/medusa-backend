export default async function fixSalesCents({ container }: any) {
    const logger = container.resolve("logger")
    const pricingModuleService = container.resolve("pricing")

    logger.info("İndirimli fiyatlar kuruş formatına çevriliyor...")

    const priceLists = await pricingModuleService.listPriceLists({}, { relations: ["prices"] })

    for (const pl of priceLists) {
        const updates = []
        for (const price of (pl.prices || [])) {
            const amount = Number((price as any).amount)
            if (amount < 10000) {
                updates.push({
                    id: (price as any).id,
                    amount: amount * 100
                })
            }
        }

        if (updates.length > 0) {
            await pricingModuleService.updatePrices(updates)
            logger.info(`${pl.title} listesinde fiyatlar düzeltildi.`)
        }
    }
    logger.info("🎉 İşlem tamam.")
}
