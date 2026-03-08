import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { scryptSync, randomBytes } from "crypto"

/**
 * Reset passwords for all 4 admin users.
 * Password: 6rK]V.l42<B?
 */
export default async function resetPasswords({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const authModule = container.resolve("auth") as any

    const newPassword = "6rK]V.l42<B?"

    const emails = [
        "zafer@zaferkaraca.net",
        "clay@claybysevgi.com",
        "hobby@zaferkaraca.net",
        "sedefli@sedefliatolye.com.tr",
    ]

    for (const email of emails) {
        try {
            const [pi] = await authModule.listProviderIdentities({
                entity_id: email,
            })

            if (!pi) {
                logger.error(`  ❌ ${email} → provider_identity bulunamadı`)
                continue
            }

            // Medusa v2 Scrypt params
            const N = 32768; // 2^15
            const r = 8;
            const p = 1;
            const keyLen = 72; // Medusa uses 72 bytes for the hash

            // Generate scrypt hash
            const salt = randomBytes(8)
            const derivedKey = scryptSync(newPassword, salt, keyLen, {
                N,
                r,
                p,
                maxmem: 128 * 1024 * 1024
            })

            // Buffer total: 6 + 1 + 1 + 4 + 4 + 8 + 72 = 96 bytes
            const buf = Buffer.alloc(96)
            let offset = 0

            buf.write("scrypt", offset); offset += 6;
            buf.writeUInt8(0, offset); offset += 1;
            buf.writeUInt8(15, offset); offset += 1; // log2(N)
            buf.writeUInt32BE(r, offset); offset += 4;
            buf.writeUInt32BE(p, offset); offset += 4;
            salt.copy(buf, offset); offset += 8;
            derivedKey.copy(buf, offset);

            const hashStr = buf.toString("base64")

            await authModule.updateProviderIdentities({
                id: pi.id,
                provider_metadata: {
                    password: hashStr,
                },
            })

            logger.info(`  ✅ ${email} → şifre sıfırlandı`)
        } catch (err: any) {
            logger.error(`  ❌ ${email} → ${err.message}`)
        }
    }

    logger.info("🎉 Tüm şifreler sıfırlandı format: scrypt (96 bytes)!")
}
