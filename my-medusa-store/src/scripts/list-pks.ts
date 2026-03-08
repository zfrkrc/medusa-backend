import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function listPKs({ container }: ExecArgs) {
    const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as any
    const pks = await remoteQuery({
        api_key: {
            fields: ["id", "token"],
        }
    })
    console.log("PKs:", JSON.stringify(pks, null, 2))
}
