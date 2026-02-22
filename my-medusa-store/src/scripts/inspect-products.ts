import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function inspectProducts({ container }: ExecArgs) {
    const productModuleService = container.resolve(Modules.PRODUCT)

    const [zafer] = await productModuleService.listProducts({
        title: "zafer"
    }, { relations: ["images"] })

    const [urun001] = await productModuleService.listProducts({
        handle: "urun001"
    }, { relations: ["images"] })

    console.log("--- ZAFER PRODUCT (WORKING) ---")
    if (zafer) {
        console.log("Images:", JSON.stringify(zafer.images, null, 2))
        console.log("Thumbnail:", zafer.thumbnail)
    } else {
        console.log("Zafer product not found")
    }

    console.log("\n--- URUN001 PRODUCT (NOT WORKING) ---")
    if (urun001) {
        console.log("Images:", JSON.stringify(urun001.images, null, 2))
        console.log("Thumbnail:", urun001.thumbnail)
    } else {
        console.log("Urun001 product not found")
    }
}
