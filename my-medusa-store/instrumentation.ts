import path from "path"

function patchAuthenticateModule(modulePath: string, label: string) {
    try {
        const fullPath = path.isAbsolute(modulePath)
            ? modulePath
            : path.join(process.cwd(), "node_modules", modulePath)

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const authModule = require(fullPath)

        if (!authModule || !authModule.authenticate) {
            return false
        }

        if (authModule.authenticate.__cookiePatched) {
            // console.log(`[cookie-auth] ⏭️  ${label} already patched`)
            return true
        }

        const originalAuthenticate = authModule.authenticate

        authModule.authenticate = function (...args: any[]) {
            const originalMiddleware = originalAuthenticate(...args)

            return async function (req: any, res: any, next: any) {
                // SADECE GİRİŞ/YETKİLENDİRME İÇİN TOKEN ENJEKTE ET
                if (req.path === "/auth/session" && req.method === "POST") {
                    console.log(`[cookie-auth] 📡 Intercepted POST /auth/session in instrumentation!`)

                    // Medusa might have authorization header sent by SDK
                    const authHeaderToken = req.headers.authorization?.replace("Bearer ", "").trim()

                    if (authHeaderToken) {
                        try {
                            const cookieStr = `_medusa_jwt_=${encodeURIComponent(authHeaderToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${10 * 60 * 60}`
                            res.setHeader("Set-Cookie", cookieStr)
                            console.log("[cookie-auth] 🍪 Successfully wrote _medusa_jwt_ cookie on POST /auth/session")
                        } catch (e) {
                            console.error("[cookie-auth] Failed to set cookie:", e)
                        }
                    }
                }

                // SADECE ÇIKIŞ İÇİN (Backend Logout Bug Fix - Return 200 and Clear Cookie)
                if (req.path === "/auth/session" && req.method === "DELETE") {
                    console.log(`[cookie-auth] 📡 Intercepted DELETE /auth/session - Wiping cookie on backend`)
                    res.setHeader("Set-Cookie", [
                        `_medusa_jwt_=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
                        `_medusa_jwt_=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
                    ])
                    res.status(200).json({ success: true, message: "Logged out natively via patch" })
                    return // Do NOT call next() or originalMiddleware
                }

                if (!req.headers.authorization && req.headers.cookie) {
                    const cookies: string = req.headers.cookie
                    const match = cookies
                        .split(";")
                        .find((c: string) => c.trim().startsWith("_medusa_jwt_="))

                    if (match) {
                        try {
                            const token = decodeURIComponent(
                                match.split("=").slice(1).join("=").trim()
                            )
                            if (token) {
                                req.headers.authorization = `Bearer ${token}`
                                console.log(`[cookie-auth] 🍪→🔑 Injected token from cookie. Extracted token length: ${token.length}`)
                            }
                        } catch (e) { console.log("[cookie-auth] Failed parsing token", e) }
                    } else {
                        console.log(`[cookie-auth] No _medusa_jwt_ in cookies... found: ${cookies}`)
                    }
                }

                if (req.path === "/admin/users/me") {
                    console.log(`[cookie-auth] Calling authenticate(/admin/users/me). Auth Header Present: ${!!req.headers.authorization}`)
                }

                return originalMiddleware(req, res, next)
            }
        }

        authModule.authenticate.__cookiePatched = true
        console.log(`[cookie-auth] ✅ Minimal Patch: ${label}`)
        return true
    } catch (e: any) {
        return false
    }
}

export function register() {
    console.log("[cookie-auth] Starting minimal patch process...")
    const paths = [
        "@medusajs/framework/dist/http/middlewares/authenticate-middleware",
        "@medusajs/medusa/dist/utils/middlewares/authenticate-middleware",
        "@medusajs/medusa/dist/api/utils/middlewares/authenticate-middleware",
        "@medusajs/medusa/dist/http/middlewares/authenticate-middleware"
    ]
    paths.forEach(p => patchAuthenticateModule(p, p))
}
