import { model } from "@medusajs/framework/utils"

export const TrProvince = model.define("tr_province", {
    id: model.id().primaryKey(),
    name: model.text(),
    plate_code: model.number(),
    districts: model.hasMany(() => TrDistrict),
})

export const TrDistrict = model.define("tr_district", {
    id: model.id().primaryKey(),
    name: model.text(),
    province: model.belongsTo(() => TrProvince, { mappedBy: "districts" }),
    neighborhoods: model.hasMany(() => TrNeighborhood),
})

export const TrNeighborhood = model.define("tr_neighborhood", {
    id: model.id().primaryKey(),
    name: model.text(),
    postal_code: model.text().nullable(),
    district: model.belongsTo(() => TrDistrict, { mappedBy: "neighborhoods" }),
})
