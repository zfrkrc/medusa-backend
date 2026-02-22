import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function checkCalculatedPrice({ container }: ExecArgs) {
    const remoteQuery = container.resolve("remoteQuery")

    // Check product 001
    const result = await remoteQuery({
        entryPoint: "product",
        fields: ["id", "title", "variants.id", "variants.title"],
        variables: { handle: "urun001" }
    })

    console.log("Calculated Price for Product 001:")
    console.log(JSON.stringify(result, null, 2))
}
