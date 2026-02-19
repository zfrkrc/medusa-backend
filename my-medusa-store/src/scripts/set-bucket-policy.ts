// @ts-nocheck
import { S3Client, PutBucketPolicyCommand } from "@aws-sdk/client-s3"
import { loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

async function setBucketPolicy() {
    const endpoint = process.env.MINIO_ENDPOINT
    const bucketName = process.env.MINIO_BUCKET
    const accessKeyId = process.env.MINIO_ACCESS_KEY
    const secretAccessKey = process.env.MINIO_SECRET_KEY
    const region = process.env.MINIO_REGION || "us-east-1"

    if (!endpoint || !bucketName || !accessKeyId || !secretAccessKey) {
        console.error("Missing MinIO configuration variables.")
        process.exit(1)
    }

    const s3Client = new S3Client({
        endpoint,
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        forcePathStyle: true,
    })

    const policy = {
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "PublicReadGetObject",
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
        ],
    }

    try {
        const command = new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(policy),
        })

        await s3Client.send(command)
        console.log(`✅ Successfully set public read policy for bucket: ${bucketName}`)
    } catch (err) {
        console.error("Error setting bucket policy:", err)
        process.exit(1)
    }
}

setBucketPolicy()
