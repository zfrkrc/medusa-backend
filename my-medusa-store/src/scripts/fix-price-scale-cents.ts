export default async function fixPriceScale({ container }: any) {
    const logger = container.resolve("logger")
    const pricingModuleService = container.resolve("pricing")

    logger.info("Fiyatlar kontrol ediliyor...")

    const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })
    logger.info(`${priceSets.length} adet price set bulundu.`)

    for (const ps of priceSets) {
        // Hem 'try' hem 'TRY' için kontrol edelim
        const tryPrice = ps.prices?.find((p: any) => p.currency_code?.toLowerCase() === "try")
        if (tryPrice) {
            const currentAmount = Number(tryPrice.amount)
            if (currentAmount < 10000) {
                const newAmount = currentAmount * 100
                await pricingModuleService.upsertPriceSets([
                    {
                        id: ps.id,
                        prices: [{ id: tryPrice.id, amount: newAmount, currency_code: tryPrice.currency_code }]
                    }
                ])
                logger.info(`Düzenlendi (ID: ${ps.id}): ${currentAmount} -> ${newAmount}`)
            }
        }
    }
    logger.info("🎉 İşlem tamamlandı.")
}
