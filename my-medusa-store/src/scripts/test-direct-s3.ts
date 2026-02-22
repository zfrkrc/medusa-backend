import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import fs from "fs"

export default async function testUploadDirect({ container }: ExecArgs) {
    const fileModuleService = container.resolve(Modules.FILE)
    const filePath = "/app/my-medusa-store/bulk-images/Urun001_1.jpeg"
    const fileBuffer = fs.readFileSync(filePath)

    // Medusa 2.0 internal structure for FileModuleService
    // It usually has a provider service
    const fileProviderService = (fileModuleService as any).fileProviderService_

    console.log("Providers:", fileProviderService.__container__.registrations)

    // Most likely it has an 's3' provider registered
    try {
        const s3Provider = container.resolve("file_provider_s3")
        console.log("S3 Provider found. Methods:", Object.keys(s3Provider))

        const result = await s3Provider.upload({
            filename: "test_direct_s3_v1.jpg",
            content: fileBuffer,
            contentType: "image/jpeg"
        })
        console.log("Direct S3 Result:", result)
    } catch (e) {
        console.error("Direct S3 failed:", e.message)
    }
}
