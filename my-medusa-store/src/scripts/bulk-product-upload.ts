import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import fs from "fs"
import path from "path"

export default async function bulkProductUpload({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const fileModuleService = container.resolve(Modules.FILE)
    const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
    const remoteLink = container.resolve("remoteLink")

    const imagesDir = "/app/my-medusa-store/bulk-images"

    if (!fs.existsSync(imagesDir)) {
        logger.error(`Resim klasörü bulunamadı: ${imagesDir}.`)
        return
    }

    logger.info("Ürün güncelleme işlemi (Buffer, mimeType: image/jpeg) başlıyor...")

    const salesChannels = await salesChannelModuleService.listSalesChannels({
        name: ["Türkiye Mağazası", "Default Sales Channel", "Default"]
    })

    let scId = salesChannels.length > 0 ? salesChannels[0].id : null

    if (!scId) {
        const allSc = await salesChannelModuleService.listSalesChannels({})
        if (allSc.length > 0) {
            scId = allSc[0].id
        }
    }

    const files = fs.readdirSync(imagesDir)
    const productGroups: Record<string, string[]> = {}

    files.forEach(file => {
        if (file.toLowerCase().endsWith(".jpeg") || file.toLowerCase().endsWith(".jpg")) {
            const match = file.match(/(.*)_\d\.jpe?g$/i)
            if (match) {
                const productName = match[1]
                if (!productGroups[productName]) {
                    productGroups[productName] = []
                }
                productGroups[productName].push(file)
            }
        }
    })

    const groupKeys = Object.keys(productGroups).sort()

    for (const groupName of groupKeys) {
        const handle = groupName.toLowerCase().replace(/_/g, "-")

        const [existingProduct] = await productModuleService.listProducts({
            handle: handle
        }, { relations: ["images"] })

        if (!existingProduct) {
            // Yeni ürün oluşturulması gerekiyorsa oluştur
            logger.info(`Yeni ürün oluşturuluyor: ${groupName}...`)
        } else {
            logger.info(`Güncelleniyor: ${groupName}...`)
        }

        const imageFiles = productGroups[groupName].sort()
        const uploadedImages: { url: string }[] = []

        for (const fileName of imageFiles) {
            const filePath = path.join(imagesDir, fileName)
            const fileBuffer = fs.readFileSync(filePath)

            try {
                const safeFileName = fileName.toLowerCase().replace(".jpeg", ".jpg")

                // FILE MODULE DIRECT UPLOAD
                const result = await fileModuleService.createFiles([
                    {
                        filename: safeFileName,
                        content: fileBuffer,
                        mimeType: "image/jpeg"
                    }
                ] as any)

                if (result && result.length > 0) {
                    uploadedImages.push({ url: result[0].url })
                    logger.info(`  Yüklendi: ${safeFileName} -> ${result[0].url}`)
                }
            } catch (error: any) {
                logger.error(`  Hata (${fileName}): ${error.message}`)
            }
        }

        if (uploadedImages.length > 0) {
            try {
                if (existingProduct) {
                    await productModuleService.updateProducts(existingProduct.id, {
                        images: uploadedImages,
                        thumbnail: uploadedImages[0].url
                    })
                    logger.info(`✅ Başarıyla güncellendi: ${groupName}`)
                } else {
                    const displayTitle = groupName.replace("Urun", "Ürün ")
                    const [product] = await productModuleService.createProducts([
                        {
                            title: displayTitle,
                            handle: handle,
                            status: "published" as any,
                            images: uploadedImages,
                            thumbnail: uploadedImages[0].url,
                            options: [{ title: "Seçenek", values: ["Standart"] }],
                            variants: [{
                                title: "Standart",
                                sku: `${handle}-std`,
                                options: { "Seçenek": "Standart" }
                            }]
                        }
                    ])

                    await remoteLink.create([
                        {
                            [Modules.PRODUCT]: { product_id: product.id },
                            [Modules.SALES_CHANNEL]: { sales_channel_id: scId }
                        }
                    ])
                    logger.info(`✅ Başarıyla oluşturuldu: ${displayTitle}`)
                }
            } catch (error: any) {
                logger.error(`❌ Kayıt hatası (${groupName}): ${error.message}`)
            }
        }
    }

    logger.info("🎉 Tüm işlemler başarıyla tamamlandı.")
}
