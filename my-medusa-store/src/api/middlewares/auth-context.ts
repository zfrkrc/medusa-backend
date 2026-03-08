import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { STORE_MANAGEMENT_MODULE } from "../../modules/store-management"
import StoreManagementService from "../../modules/store-management/service"
import { Modules } from "@medusajs/framework/utils"

/**
 * Extracts admin email from auth token claims and attaches it to the request.
 * Must run AFTER Medusa's authenticate() middleware.
 */
export async function authContextMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
) {
    try {
        const authContext = (req as any).auth_context
        if (!authContext) return next()

        // 1. Try claims
        let email =
            authContext.app_metadata?.email ||
            authContext.session?.email ||
            authContext.details?.email ||
            null

        // 2. Fallback: Retrieve from DB via actor_id
        if (!email && authContext.actor_id && authContext.actor_type === "user") {
            try {
                const userService = req.scope.resolve(Modules.USER)
                const user = await userService.retrieveUser(authContext.actor_id)
                email = user.email
                console.log(`[auth-context] Email resolved from DB for actor ${authContext.actor_id}: ${email}`)
            } catch (e) {
                console.error(`[auth-context] Failed to retrieve user ${authContext.actor_id}:`, e)
            }
        }

        if (email) {
            ; (req as any)._adminEmail = email
        }

        return next()
    } catch {
        return next()
    }
}

/**
 * publicStoreHeader middleware
 *
 * Reads the `x-store-handle` header sent by each storefront and injects
 * the matching store_id into the request context.  The store API routes
 * then use this to scope public (non-admin) queries.
 */
export async function publicStoreHeaderMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
) {
    try {
        const storeManagementService: StoreManagementService =
            req.scope.resolve(STORE_MANAGEMENT_MODULE)

        let store = null
        const storeHandle = req.headers["x-store-handle"] as string | undefined

        if (storeHandle) {
            store = await storeManagementService.findStoreByHandle(storeHandle)
        } else {
            // Fallback: Resolve by Domain (Host)
            const host = req.get("host") || ""
            const allStores = await storeManagementService.listStores()
            store = allStores.find((s: any) =>
                s.domain && (host === s.domain || host.endsWith("." + s.domain))
            )
        }

        if (store) {
            ; (req as any).store_id = store.id
                ; (req as any).storeTenant = store
        }

        return next()
    } catch {
        return next()
    }
}
