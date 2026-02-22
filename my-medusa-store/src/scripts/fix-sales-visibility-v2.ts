import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixSalesVisibilityV2({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)
    const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
    const regionModuleService = container.resolve(Modules.REGION)
    const remoteQuery = container.resolve("remoteQuery")
    const remoteLink = container.resolve("remoteLink")

    logger.info("İndirimlerin görünürlüğü düzeltiliyor (V2 - Sales Channel & Region)...")

    // 1. Önceki listeleri temizleyelim
    const oldPriceLists = await pricingModuleService.listPriceLists({
        title: ["Büyük İndirim", "Sezon Sonu İndirimi"]
    })
    if (oldPriceLists.length > 0) {
        await pricingModuleService.deletePriceLists(oldPriceLists.map(pl => pl.id))
    }

    // 2. Region ve Sales Channel bilgilerini alalım
    const [region] = await regionModuleService.listRegions({})
    const [salesChannel] = await salesChannelModuleService.listSalesChannels({ name: "Türkiye Mağazası" })
    const defaultSalesChannel = (await salesChannelModuleService.listSalesChannels({})).find(sc => sc.name === "Default Sales Channel")

    const scId = salesChannel?.id || defaultSalesChannel?.id

    if (!region || !scId) {
        logger.error("Region veya Sales Channel bulunamadı!")
        return
    }

    // 3. Ürünleri alalım
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
                    const saleAmount = Math.floor(originalAmount * 0.7) // %30 indirim

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
        const [priceList] = await pricingModuleService.createPriceLists([
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

        // Link price list to sales channel
        await remoteLink.create([
            {
                [Modules.PRICING]: { price_list_id: priceList.id },
                [Modules.SALES_CHANNEL]: { sales_channel_id: scId }
            }
        ])

        logger.info(`🎉 İndirimler tanımlandı ve ${scId} nolu satış kanalına bağlandı.`)
    }
}
