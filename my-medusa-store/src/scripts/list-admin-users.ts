import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function listAdminUsers({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const userService = container.resolve(Modules.USER)

    const users = await userService.listUsers({}, { take: 100 })

    logger.info(`\n📋 Mevcut Medusa Admin Kullanıcıları (${users.length} adet):`)
    for (const u of users) {
        logger.info(`  - ${u.email} (id: ${u.id})`)
    }
}
