import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function listApiKeys({ container }: ExecArgs) {
    const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as any
    try {
        const keys = await remoteQuery({
            api_key: {
                fields: ["id", "token", "title", "type"]
            }
        })
        console.log("Found API Keys:", JSON.stringify(keys, null, 2))
    } catch (e: any) {
        console.error("Failed to list API keys:", e.message)
    }
}
