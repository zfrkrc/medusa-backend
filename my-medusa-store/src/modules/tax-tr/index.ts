import { Module } from "@medusajs/framework/utils"
import TrTaxProviderService from "./service"

export const TAX_TR_MODULE = "tax-tr"

export default Module(TAX_TR_MODULE, {
    service: TrTaxProviderService as any,
})
