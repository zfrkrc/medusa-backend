export default async function cleanAndCreateSales({ container }: any) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve("product")
    const pricingModuleService = container.resolve("pricing")
    const remoteQuery = container.resolve("remoteQuery")

    logger.info("İndirimler temizleniyor...")

    const allPriceLists = await pricingModuleService.listPriceLists({})
    if (allPriceLists.length > 0) {
        await pricingModuleService.deletePriceLists(allPriceLists.map((pl: any) => pl.id))
        logger.info("Eski indirimler silindi.")
    }

    const products = await productModuleService.listProducts(
        { handle: { $like: "urun%" } },
        { relations: ["variants"], take: 50 }
    )

    const prices = []
    for (const product of products) {
        for (const variant of product.variants) {
            const links = await remoteQuery({
                entryPoint: "product_variant_price_set",
                fields: ["price_set_id"],
                variables: { variant_id: [variant.id] }
            })

            if (links && links.length > 0) {
                const priceSetId = links[0].price_set_id
                const priceSet = await pricingModuleService.retrievePriceSet(priceSetId, { relations: ["prices"] })
                const tryPrice = priceSet.prices?.find((p: any) => p.currency_code === "try")

                if (tryPrice) {
                    const originalAmount = Number(tryPrice.amount)
                    // Fiyat zaten kuruş formatındaysa indirim de kuruş formatında olmalı
                    prices.push({
                        amount: Math.floor(originalAmount * 0.75),
                        currency_code: "try",
                        price_set_id: priceSetId
                    })
                }
            }
        }
    }

    if (prices.length > 0) {
        await pricingModuleService.createPriceLists([
            {
                title: "Genel İndirim",
                description: "Tüm ürünlerde %25 indirim", // Bu alan zorunlu
                type: "sale",
                status: "active",
                prices: prices
            }
        ])
        logger.info(`🎉 ${prices.length} adet varyant için indirim tanımlandı.`)
    } else {
        logger.warn("İndirim tanımlanacak uygun ürün/fiyat bulunamadı.")
    }
}
