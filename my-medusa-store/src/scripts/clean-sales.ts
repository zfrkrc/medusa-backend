import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function cleanAndCreateSales({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)
    const remoteQuery = container.resolve("remoteQuery")

    logger.info("Tüm indirimler temizleniyor ve yeniden oluşturuluyor...")

    // 1. Tüm price listeleri silelim
    const allPriceLists = await pricingModuleService.listPriceLists({})
    if (allPriceLists.length > 0) {
        await pricingModuleService.deletePriceLists(allPriceLists.map(pl => pl.id))
        logger.info(`${allPriceLists.length} adet eski indirim listesi silindi.`)
    }

    // 2. Ürünleri alalım
    const products = await productModuleService.listProducts(
        { handle: { $like: "urun%" } },
        { relations: ["variants"], take: 10 }
    )

    const prices = []
    for (const product of products) {
        for (const variant of product.variants) {
            const links = await remoteQuery({
                entryPoint: "product_variant_price_set",
                fields: ["price_set_id"],
                variables: { variant_id: [variant.id] }
            }) as any[]

            if (links && links.length > 0) {
                const priceSetId = links[0].price_set_id
                const priceSet = await pricingModuleService.retrievePriceSet(priceSetId, { relations: ["prices"] })
                const tryPrice = priceSet.prices?.find((p: any) => p.currency_code === "try")

                if (tryPrice) {
                    const originalAmount = Number(tryPrice.amount)
                    const saleAmount = Math.floor(originalAmount * 0.75) // %25 indirim

                    prices.push({
                        amount: saleAmount,
                        currency_code: "try",
                        price_set_id: priceSetId
                    })
                    logger.info(`İndirim hazır: ${product.title} (${originalAmount} -> ${saleAmount})`)
                }
            }
        }
    }

    if (prices.length > 0) {
        // KURALSIZ (Global) bir liste oluşturalım
        await pricingModuleService.createPriceLists([
            {
                title: "Genel İndirim",
                description: "Tüm mağazada geçerli %25 indirim",
                type: "sale" as any,
                status: "active" as any,
                prices: prices
            }
        ])
        logger.info(`🎉 ${prices.length} fiyat ile Genel İndirim oluşturuldu.`)
    }
}
