import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function debugFileService({ container }: ExecArgs) {
    const fileModuleService = container.resolve(Modules.FILE)
    console.log("File Module Service Methods:", Object.keys(fileModuleService))
    console.log("File Module Service Prototype Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(fileModuleService)))
}
