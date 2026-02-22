import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function createSales({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)
    const remoteQuery = container.resolve("remoteQuery")

    logger.info("Bazı ürünlere %20 indirim uygulanıyor...")

    const products = await productModuleService.listProducts(
        { handle: { $like: "urun%" } },
        { relations: ["variants"], take: 10 }
    )

    const prices = []

    for (const product of products) {
        for (const variant of product.variants) {
            const query = {
                product_variant_price_set: {
                    __args: { variant_id: [variant.id] },
                    fields: ["price_set_id"],
                },
            }
            const links = await remoteQuery(query)

            if (links && links.length > 0) {
                const priceSetId = links[0].price_set_id
                const priceSet = await pricingModuleService.retrievePriceSet(priceSetId, { relations: ["prices"] })
                const tryPrice = priceSet.prices?.find(p => p.currency_code === "try")

                if (tryPrice) {
                    const originalAmount = tryPrice.amount
                    const saleAmount = Math.floor(originalAmount * 0.8)

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
        await pricingModuleService.createPriceLists([
            {
                title: "Büyük İndirim",
                description: "Seçili ürünlerde %20 indirim",
                type: "sale" as any,
                status: "active" as any,
                prices: prices
            }
        ])
    }

    logger.info("🎉 İndirimler başarıyla tanımlandı.")
}
