import { model } from "@medusajs/framework/utils"

const AdminUser = model.define("admin_user_store", {
    id: model.id().primaryKey(),
    email: model.text(),
    role: model.enum(["super_admin", "store_admin"]),
    store_id: model.text().nullable(), // null = super_admin, set = store_admin
    // created_at ve updated_at Medusa DML tarafından otomatik eklenir
})

export default AdminUser
