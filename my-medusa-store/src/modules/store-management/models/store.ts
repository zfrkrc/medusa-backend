import { model } from "@medusajs/framework/utils"

const Store = model.define("store_tenant", {
    id: model.id().primaryKey(),
    name: model.text(),
    handle: model.text(), // e.g. "clay-store", "hobby-store"
    domain: model.text().nullable(),
    publishable_key_id: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    // created_at ve updated_at Medusa DML tarafından otomatik eklenir
})

export default Store
