export default async function fixPriceScale({ container }: any) {
    const logger = container.resolve("logger")
    // Medusa v2'de servis adı 'pricing'dir
    const pricingModuleService = container.resolve("pricing")

    logger.info("Fiyatlar TL bazında 100 ile çarpılarak cent (kuruş) formatına getiriliyor...")

    const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })

    for (const ps of priceSets) {
        const tryPrice = ps.prices?.find((p: any) => p.currency_code === "try")
        if (tryPrice) {
            const currentAmount = Number(tryPrice.amount)
            if (currentAmount < 10000) {
                const newAmount = currentAmount * 100
                await pricingModuleService.upsertPriceSets([
                    {
                        id: ps.id,
                        prices: [{ id: tryPrice.id, amount: newAmount, currency_code: "try" }]
                    }
                ])
                logger.info(`Düzenlendi: ${currentAmount} -> ${newAmount}`)
            }
        }
    }
    logger.info("🎉 Bitti.")
}
