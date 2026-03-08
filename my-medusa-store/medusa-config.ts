import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import path from "path"

// ============================================================
// Cookie Auth Patch Moved to instrumentation.ts
// ============================================================
try {
  const { register } = require("./instrumentation")
  register()
} catch (e) {
  console.error("Failed to register instrumentation:", e)
}


loadEnv(process.env.NODE_ENV || 'development', process.cwd())
loadEnv(process.env.NODE_ENV || 'development', '../') // Docker'daki üst klasördeki .env için

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.REDIS_URL

module.exports = defineConfig({
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    path: "/app",
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:7001",
    ...(process.env.NODE_ENV === 'development' ? {
      vite: (config: any) => {
        return {
          define: {
            __MAX_UPLOAD_FILE_SIZE__: 10 * 1024 * 1024, // 10MB
          },
          server: {
            allowedHosts: [
              "localhost",
              ".localhost",
              "127.0.0.1",
              "panel.claybysevgi.com",
              "panel.sedefliatolye.com.tr",
              "panel.zaferkaraca.net",
              "hobby.zaferkaraca.net",
              "172.16.16.97",
              "172.16.16.98",
              "172.16.16.99",
              true
            ],
            host: "0.0.0.0",
            hmr: {
              port: 5173,
              clientPort: 5173,
            },
          },
        }
      },
    } : {}),
  },
  projectConfig: {
    databaseUrl: DATABASE_URL,
    redisUrl: REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "*",
      adminCors: process.env.ADMIN_CORS || "*",
      authCors: process.env.AUTH_CORS || process.env.ADMIN_CORS || "*",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
    databaseDriverOptions: { ssl: false, sslmode: "disable" },
    workerMode: process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server" || "shared",
  },
  modules: [
    // ─── Auth Modülü — sadece emailpass (admin panel girişi) ─
    // Google OAuth storefront müşterileri için Better Auth üzerinden çalışır.
    {
      resolve: "@medusajs/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/auth-emailpass",
            id: "emailpass",
            options: {},
          },
        ],
      },
    },

    // ─── Ödeme Sağlayıcıları ─────────────────────────────────
    // Her provider için .env'e anahtarları ekle, yorumu kaldır.
    {
      resolve: "@medusajs/payment",
      options: {
        providers: [
          // ── iyzico ──────────────────────────────────────────
          // .env: IYZICO_API_KEY, IYZICO_SECRET_KEY
          // {
          //   resolve: "./src/integrations/payments/iyzico/provider",
          //   id: "iyzico",
          //   options: {
          //     api_key:    process.env.IYZICO_API_KEY,
          //     secret_key: process.env.IYZICO_SECRET_KEY,
          //     sandbox:    process.env.IYZICO_SANDBOX === "true",
          //   },
          // },

          // ── PayTR ────────────────────────────────────────────
          // .env: PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT
          // {
          //   resolve: "./src/integrations/payments/paytr/provider",
          //   id: "paytr",
          //   options: {
          //     merchant_id:   process.env.PAYTR_MERCHANT_ID,
          //     merchant_key:  process.env.PAYTR_MERCHANT_KEY,
          //     merchant_salt: process.env.PAYTR_MERCHANT_SALT,
          //     test_mode:     process.env.PAYTR_TEST_MODE === "true",
          //   },
          // },

          // ── PayU ─────────────────────────────────────────────
          // .env: PAYU_MERCHANT_ID, PAYU_SECRET_KEY
          // {
          //   resolve: "./src/integrations/payments/payu/provider",
          //   id: "payu",
          //   options: {
          //     merchant_id: process.env.PAYU_MERCHANT_ID,
          //     secret_key:  process.env.PAYU_SECRET_KEY,
          //     base_url:    process.env.PAYU_BASE_URL || "https://secure.payu.com.tr",
          //   },
          // },
        ],
      },
    },
    {
      resolve: "@medusajs/file",
      options: {
        providers: [
          process.env.MINIO_ACCESS_KEY ? {
            resolve: "@medusajs/file-s3",
            id: "s3",
            options: {
              file_url: `${process.env.MINIO_PUBLIC_URL || process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}`,
              access_key_id: process.env.MINIO_ACCESS_KEY,
              secret_access_key: process.env.MINIO_SECRET_KEY,
              region: process.env.MINIO_REGION || "us-east-1",
              bucket: process.env.MINIO_BUCKET,
              endpoint: process.env.MINIO_ENDPOINT,
              additional_client_config: {
                forcePathStyle: true, // MinIO için ZORUNLU
              },
            },
          } : {
            resolve: "@medusajs/file-local",
            id: "local",
            options: {
              upload_dir: "uploads",
              backend_url: process.env.MEDUSA_BACKEND_URL || "http://localhost:7001"
            }
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/email-notifications",
            id: "smtp",
            options: {
              channels: ["email"],
            },
          },
        ],
      },
    },
    // Redis Event Bus - session ve event yönetimi için gerekli
    ...(REDIS_URL ? [{
      key: "event_bus",
      resolve: "@medusajs/event-bus-redis",
      options: {
        redisUrl: REDIS_URL,
      },
    }] : []),
    // Redis Cache
    ...(REDIS_URL ? [{
      key: "cache",
      resolve: "@medusajs/cache-redis",
      options: {
        redisUrl: REDIS_URL,
      },
    }] : []),
    // Custom: Turkey Address Module (Provinces/Districts/Neighborhoods)
    {
      key: "address_tr",
      resolve: "./src/modules/address-tr",
      options: {
        databaseUrl: DATABASE_URL,
      },
    },
    // Custom: Multi-Store Tenant Management + RBAC
    {
      key: "store_management",
      resolve: "./src/modules/store-management",
    },
    // Shipping Module — kargo sağlayıcılar buraya eklenir
    {
      key: "shipping",
      resolve: "./src/modules/shipping",
      options: {
        // default_provider: "yurtici",
        // providers dizisi provider implementasyonları eklenince doldurulur:
        // providers: [
        //   { identifier: "yurtici", options: { api_key: process.env.YURTICI_API_KEY, customer_no: process.env.YURTICI_CUSTOMER_NO } },
        //   { identifier: "aras",    options: { username: process.env.ARAS_USERNAME, password: process.env.ARAS_PASSWORD } },
        //   { identifier: "mng",     options: { customer_code: process.env.MNG_CUSTOMER_CODE } },
        // ]
      },
    },
    // e-Fatura / e-Arşiv Modülü (Paraşüt)
    // .env: PARASUT_CLIENT_ID, PARASUT_CLIENT_SECRET, PARASUT_USERNAME, PARASUT_PASSWORD, PARASUT_COMPANY_ID
    // INVOICE_PROVIDER=parasut, INVOICE_TYPE=earchive|einvoice
    {
      key: "invoicing",
      resolve: "./src/modules/invoicing",
      options: {
        // Aktifleştirmek için env değişkenlerini doldurun:
        // provider: "parasut",
        // parasut: {
        //   client_id:     process.env.PARASUT_CLIENT_ID,
        //   client_secret: process.env.PARASUT_CLIENT_SECRET,
        //   username:      process.env.PARASUT_USERNAME,
        //   password:      process.env.PARASUT_PASSWORD,
        //   company_id:    process.env.PARASUT_COMPANY_ID,
        //   base_url:      process.env.PARASUT_BASE_URL || "https://api.parasut.com",
        // },
      },
    },
    /*
    {
      key: "tax_tr",
      resolve: "./src/modules/tax-tr",
    },
    */
  ],
})
