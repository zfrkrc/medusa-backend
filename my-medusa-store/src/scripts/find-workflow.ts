import { ExecArgs } from "@medusajs/framework/types"

export default async function listWorkflows({ container }: ExecArgs) {
    // Medusa doesnt have a simple list of workflows in the container usually, 
    // but we can try to find them in the internal registers if we know where to look.
    // However, I will just try to import the most common ones.
    try {
        const { uploadFilesWorkflow } = require("@medusajs/medusa/core-flows")
        console.log("uploadFilesWorkflow FOUND in @medusajs/medusa/core-flows")
    } catch (e) {
        try {
            const { uploadFilesWorkflow } = require("@medusajs/core-flows")
            console.log("uploadFilesWorkflow FOUND in @medusajs/core-flows")
        } catch (e2) {
            console.log("uploadFilesWorkflow NOT FOUND")
        }
    }
}
