import { ExecArgs } from "@medusajs/framework/types"

export default async function simpleTest({ container }: ExecArgs) {
    console.log("HELLO FROM MEDUSA EXEC")
}
