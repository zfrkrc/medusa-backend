import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixSalesVisibility({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)
    const remoteQuery = container.resolve("remoteQuery")

    logger.info("İndirimlerin görünürlüğü düzeltiliyor...")

    // 1. Önceki listeleri temizleyelim
    const oldPriceLists = await pricingModuleService.listPriceLists({
        title: ["Büyük İndirim", "Sezon Sonu İndirimi"]
    })
    if (oldPriceLists.length > 0) {
        await pricingModuleService.deletePriceLists(oldPriceLists.map(pl => pl.id))
    }

    // 2. Region ID'yi alalım
    const regionModuleService = container.resolve(Modules.REGION)
    const [region] = await regionModuleService.listRegions({})
    if (!region) {
        logger.error("Region bulunamadı!")
        return
    }

    // 3. Ürünleri alalım
    const products = await productModuleService.listProducts(
        { handle: { $like: "urun%" } },
        { relations: ["variants"], take: 20 }
    )

    const prices = []
    for (const product of products.slice(0, 10)) { // İlk 10 ürün
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
                    const saleAmount = Math.floor(originalAmount * 0.7) // %30 indirim yapalım daha belirgin olsun

                    prices.push({
                        amount: saleAmount,
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
                title: "Büyük İndirim",
                description: "Seçili ürünlerde %30 indirim",
                type: "sale" as any,
                status: "active" as any,
                rules: {
                    region_id: [region.id]
                },
                prices: prices
            }
        ])
        logger.info(`🎉 ${prices.length} adet varyant için %30 indirim tanımlandı. Region: ${region.name}`)
    }
}
