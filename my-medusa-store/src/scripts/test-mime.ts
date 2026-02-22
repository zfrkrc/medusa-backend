import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import fs from "fs"

export default async function testUploadMime({ container }: ExecArgs) {
    const fileModuleService = container.resolve(Modules.FILE)
    const filePath = "/app/my-medusa-store/bulk-images/Urun001_1.jpeg"
    const fileBuffer = fs.readFileSync(filePath)

    console.log("Method 5: createFiles with mimeType")
    try {
        const result5 = await fileModuleService.createFiles([
            {
                filename: "test5_mimeType.jpg",
                content: fileBuffer,
                mimeType: "image/jpeg"
            }
        ] as any)
        console.log("Result 5 URL:", result5[0].url)
    } catch (e) {
        console.error("Method 5 failed:", e.message)
    }
}
