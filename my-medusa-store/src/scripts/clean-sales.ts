export default async function cleanAndCreateSales({ container }) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve("productModuleService")
    const pricingModuleService = container.resolve("pricingModuleService")
    const remoteQuery = container.resolve("remoteQuery")

    logger.info("İndirimler temizleniyor ve %25 indirim tanımlanıyor...")

    const allPriceLists = await pricingModuleService.listPriceLists({})
    if (allPriceLists.length > 0) {
        await pricingModuleService.deletePriceLists(allPriceLists.map((pl) => pl.id))
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
                const tryPrice = priceSet.prices?.find((p) => p.currency_code === "try")

                if (tryPrice) {
                    const originalAmount = Number(tryPrice.amount)
                    prices.push({
                        amount: Math.floor(originalAmount * 0.75), // %25 indirim
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
                description: "Tüm ürünlerde %25 indirim",
                type: "sale",
                status: "active",
                prices: prices
            }
        ])
        logger.info(`🎉 ${prices.length} adet varyant için indirim tanımlandı.`)
    }
}
