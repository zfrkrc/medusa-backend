import StoreManagementService from "./service"
import { Module } from "@medusajs/framework/utils"

export const STORE_MANAGEMENT_MODULE = "store_management"

export default Module(STORE_MANAGEMENT_MODULE, {
    service: StoreManagementService,
})
