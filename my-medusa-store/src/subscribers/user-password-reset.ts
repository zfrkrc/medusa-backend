import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa"
import { INotificationModuleService, IUserModuleService } from "@medusajs/types"
import { Modules } from "@medusajs/utils"

export default async function userPasswordResetHandler({
    event: { data },
    container,
}: SubscriberArgs<{ entity_id: string; token: string; email?: string }>) {
    const notificationModuleService: INotificationModuleService = container.resolve(
        Modules.NOTIFICATION
    )
    const userModuleService: IUserModuleService = container.resolve(
        Modules.USER
    )

    let email = (data as any).email
    const entityId = data.entity_id

    console.log(`Password reset requested for entity_id: ${entityId}, token provided: ${Boolean(data.token)}`)

    // 1. Durum: Entity ID bir e-posta adresi ise (Genellikle Admin Auth Provider böyle çalışır)
    if (!email && entityId && entityId.includes("@")) {
        email = entityId
        console.log(`Using entity_id as email directly: ${email}`)
    }

    // 2. Durum: Entity ID bir ID formatındaysa (usr_...), veritabanından bulmaya çalış
    if (!email && entityId && !entityId.includes("@")) {
        try {
            const user = await userModuleService.retrieveUser(entityId)
            email = user.email
            console.log(`Found user via ID (${entityId}), email is: ${email}`)
        } catch (error) {
            console.warn(`User lookup failed for ID ${entityId}: ${(error as any).message}`)
            // Kullanıcı bulunamadıysa işlem durur, e-posta atılamaz.
        }
    }

    if (!email) {
        console.warn("Could not resolve email address for password reset request.")
        return
    }

    const adminUrl = process.env.ADMIN_CORS?.split(",")[0] || "https://panel.zaferkaraca.net"
    // Link oluştururken, email parametresini entity_id (eğer email ise) olarak kullanabiliriz
    const resetLink = `${adminUrl}/reset-password?token=${data.token}&email=${email}`

    try {
        await notificationModuleService.createNotifications({
            to: email,
            channel: "email",
            template: "password-reset",
            data: {
                password_reset_url: resetLink,
                email: email,
                token: data.token,
            },
        })
        console.log(`Password reset email triggered for ${email}`)
    } catch (error) {
        console.error("Failed to send password reset notification:", error)
    }
}

export const config: SubscriberConfig = {
    event: "auth.password_reset",
}
