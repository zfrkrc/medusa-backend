import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import {
    ProviderSendNotificationDTO,
    ProviderSendNotificationResultsDTO
} from "@medusajs/framework/types"
import nodemailer from "nodemailer"

class SmtpNotificationProviderService extends AbstractNotificationProviderService {
    static identifier = "smtp-notification"
    protected transporter: nodemailer.Transporter

    constructor() {
        super()
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                // secure: false (TLS) için gerekli olabilir
                rejectUnauthorized: false
            }
        })
    }

    async send(
        notification: ProviderSendNotificationDTO
    ): Promise<ProviderSendNotificationResultsDTO> {
        const { to, data } = notification

        // Basit Template Engine
        // notification.template isminden şablon seçimi yapıyoruz
        // Medusa v2'de `template` alanı DTO'da olmayabilir, `content.template` veya `data` içinden gelir.
        // Ancak `createNotifications` metoduna `template` geçiyoruz, bu yüzden `notification` objesinde olmalı.

        const templateName = (notification as any).template || "simple"
        const subject = (data as any)?.subject || "Hobby Store Notification"
        let htmlBody = ""

        // Şifre Sıfırlama Şablonu
        if (templateName === "password-reset") {
            const resetUrl = (data as any)?.password_reset_url || "#"
            const email = (data as any)?.email || to

            htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #eee;">
          <h2 style="color: #FF6B6B;">Hobby Store Şifre Sıfırlama</h2>
          <p>Merhaba ${email},</p>
          <p>Hesabınız için bir şifre sıfırlama talebi aldık. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
          <div style="text-align: center; margin: 30px 0;">
             <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Şifremi Sıfırla</a>
          </div>
          <p>Eğer bu işlemi siz yapmadıysanız, lütfen bu e-postayı dikkate almayın.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #999;">Medusa v2 Admin • panel.zaferkaraca.net</small>
        </div>
      `
        } else {
            // Varsayılan (Generic) Şablon
            htmlBody = `
        <div style="font-family: Arial, sans-serif;">
          <p>${(notification.content as any)?.html || (notification.content as any)?.body || JSON.stringify(data)}</p>
        </div>
      `
        }

        try {
            const info = await this.transporter.sendMail({
                from: process.env.SMTP_FROM,
                to,
                subject: subject === "Hobby Store Notification" && templateName === "password-reset" ? "Şifre Sıfırlama Talebi" : subject,
                html: htmlBody,
            })
            console.log(`Email '${templateName}' sent to ${to}: ${info.messageId}`)
            return {}
        } catch (error) {
            console.error("SMTP Notification Error:", error)
            throw error
        }
    }
}

export default SmtpNotificationProviderService
