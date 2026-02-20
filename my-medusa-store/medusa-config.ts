import { loadEnv, defineConfig } from '@medusajs/framework/utils'

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
      vite: (config) => {
        return {
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
              backend_url: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
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
  ],
})
