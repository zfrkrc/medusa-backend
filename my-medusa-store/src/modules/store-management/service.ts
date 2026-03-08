import { MedusaService } from "@medusajs/framework/utils"
import Store from "./models/store"
import AdminUser from "./models/admin-user"

class StoreManagementService extends MedusaService({
    Store,
    AdminUser,
}) {
    // --- Store (tenant) helpers ---

    async findStoreByHandle(handle: string) {
        const [store] = await this.listStores({ handle } as any)
        return store ?? null
    }

    async findStoreById(id: string) {
        const [store] = await this.listStores({ id } as any)
        return store ?? null
    }

    // --- AdminUser helpers ---

    async findAdminByEmail(email: string) {
        const [user] = await this.listAdminUsers({ email } as any)
        return user ?? null
    }

    async findAdminById(id: string) {
        const [user] = await this.listAdminUsers({ id } as any)
        return user ?? null
    }

    /**
     * Returns the store_id for a given admin email.
     * super_admin returns null (=no restriction).
     */
    async getStoreIdForAdmin(email: string): Promise<string | null> {
        const admin = await this.findAdminByEmail(email)
        if (!admin) return null
        if (admin.role === "super_admin") return null
        return admin.store_id ?? null
    }

    async isSuperAdmin(email: string): Promise<boolean> {
        const admin = await this.findAdminByEmail(email)
        return admin?.role === "super_admin"
    }
}

export default StoreManagementService
