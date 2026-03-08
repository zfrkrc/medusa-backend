import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function verifyMetadata({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const productService = container.resolve(Modules.PRODUCT)

    const [products] = await productService.listAndCountProducts({}, { take: 5 })

    logger.info("Verifying first 5 products metadata:")
    for (const p of products) {
        logger.info(`Product: ${p.handle} | Metadata: ${JSON.stringify(p.metadata)}`)
    }
}
