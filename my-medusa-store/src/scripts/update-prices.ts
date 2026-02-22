import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function updateProductPrices({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)
    const remoteLink = container.resolve("remoteLink")

    logger.info("Ürün fiyatları oluşturuluyor ve bağlanıyor (1000 - 3000 TL arası)...")

    const products = await productModuleService.listProducts(
        { handle: { $like: "urun%" } },
        { relations: ["variants"] }
    )

    logger.info(`${products.length} adet ürün bulundu.`)

    for (const product of products) {
        for (const variant of product.variants) {
            const randomPrice = Math.floor(Math.random() * (3000 - 1000 + 1) + 1000)
            const amount = randomPrice * 100

            try {
                // 1. Yeni bir Price Set oluştur
                const priceSet = await pricingModuleService.createPriceSets([
                    {
                        prices: [
                            {
                                currency_code: "try",
                                amount: amount,
                            }
                        ]
                    }
                ])

                // 2. Varyant ile Price Set'i birbirine bağla (Medusa 2.0 Link System)
                await remoteLink.create([
                    {
                        [Modules.PRODUCT]: { variant_id: variant.id },
                        [Modules.PRICING]: { price_set_id: priceSet[0].id }
                    }
                ])

                logger.info(`Fiyat oluşturuldu ve bağlandı: ${product.title} - ${randomPrice} TL`)
            } catch (error: any) {
                logger.error(`İşlem hatası (${product.title}): ${error.message}`)
            }
        }
    }

    logger.info("🎉 İşlem tamamlandı.")
}
