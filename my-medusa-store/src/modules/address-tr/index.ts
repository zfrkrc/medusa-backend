import { Module } from "@medusajs/framework/utils"
import AddressTrService from "./service"
import * as Models from "./models"

export const ADDRESS_TR_MODULE = "address_tr"

export default Module(ADDRESS_TR_MODULE, {
    service: AddressTrService,
})

export const models = Models
