import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import fs from "fs"

export default async function testUpload({ container }: ExecArgs) {
    const fileModuleService = container.resolve(Modules.FILE)
    const filePath = "/app/my-medusa-store/bulk-images/Urun001_1.jpeg"
    const fileBuffer = fs.readFileSync(filePath)

    console.log("Method 3: createFiles with Array and Buffer")
    try {
        const result3 = await fileModuleService.createFiles([
            {
                filename: "test3_buffer.jpg",
                file: fileBuffer,
            }
        ])
        console.log("Result 3 URL:", result3[0].url)
    } catch (e) {
        console.error("Method 3 failed:", e.message)
    }

    console.log("\nMethod 4: createFiles with Buffer and properties")
    try {
        // Some versions use 'content' instead of 'file'
        const result4 = await fileModuleService.createFiles([
            {
                filename: "test4_content.jpg",
                content: fileBuffer,
            }
        ] as any)
        console.log("Result 4 URL:", result4[0].url)
    } catch (e) {
        console.error("Method 4 failed:", e.message)
    }
}
