import { defineWidgetConfig } from "@medusajs/admin-sdk"

/**
 * Global Variable Fixer & Logout Cookie Cleaner Widget
 * 
 * 1. Global Variable Fix: Medusa Admin v2 sometimes misses environment-injected globals 
 *    like __MAX_UPLOAD_FILE_SIZE__. We define them here to prevent ReferenceErrors (crash).
 * 2. Logout Bug Fix: Intercepts DELETE /auth/session fetch requests to clear cookies 
 *    locally and return 200 OK, bypassing native 401 bugs.
 */
const AdminBridgeWidget = () => {
    if (typeof window !== "undefined") {
        // --- 1. GLOBAL VARIABLE INJECTION ---
        // Prevents: "ReferenceError: __MAX_UPLOAD_FILE_SIZE__ is not defined"
        if (typeof (window as any).__MAX_UPLOAD_FILE_SIZE__ === "undefined") {
            (window as any).__MAX_UPLOAD_FILE_SIZE__ = 10 * 1024 * 1024; // 10MB Default
            console.log("[admin-bridge] 🔧 Injected missing __MAX_UPLOAD_FILE_SIZE__");
        }

        if (typeof (window as any).__MEDUSA_ADMIN_PATH__ === "undefined") {
            (window as any).__MEDUSA_ADMIN_PATH__ = "/app";
        }

        // Widgets için backend URL (same-origin = boş string)
        if (typeof (window as any).__MEDUSA_BACKEND_URL__ === "undefined") {
            (window as any).__MEDUSA_BACKEND_URL__ = "";
        }

        // --- 2. LOGOUT & FETCH INTERCEPTOR ---
        if (!window.__logoutPatched) {
            const originalFetch = window.fetch

            window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
                const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
                const method = init?.method || (input instanceof Request ? input.method : "GET")

                // Intercept Medusa Admin Logout Request
                if (method === "DELETE" && url.includes("/auth/session")) {
                    console.log("[admin-bridge] 🛑 Intercepting logout...")

                    // Clear cookies
                    document.cookie = "_medusa_jwt_=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax"
                    document.cookie = "_medusa_jwt_=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=None; Secure"

                    try {
                        await originalFetch(input, init)
                    } catch (err) {
                        // Ignore backend 401 errors on logout
                    }

                    return new Response(JSON.stringify({ success: true, message: "Logged out locally" }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    })
                }

                return originalFetch(input, init)
            }

            window.__logoutPatched = true
            console.log("[admin-bridge] ✅ Admin environment patched successfully.")
        }
    }

    return null
}

export const config = defineWidgetConfig({
    // Render in an area loaded early and on most pages
    zone: "product.list.before",
})

export default AdminBridgeWidget

// TypeScript support
declare global {
    interface Window {
        __logoutPatched?: boolean;
    }
}
