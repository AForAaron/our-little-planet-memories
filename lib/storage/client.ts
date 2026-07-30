import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isObjectStorageConfigured } from "@/lib/config/backend";

export type StorageProviderName = "r2" | "s3";

export type PrivateObjectMeta = {
  contentLength?: number;
  contentType?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`对象存储尚未配置：缺少 ${name}。`);
  return value;
}

export function getStorageProvider(): StorageProviderName {
  const value = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (value === "s3" || value === "cos" || value === "cloudbase") return "s3";
  return "r2";
}

export { isObjectStorageConfigured };

function getBucket() {
  if (getStorageProvider() === "s3") return requireEnv("S3_BUCKET");
  return requireEnv("R2_BUCKET");
}

let client: S3Client | undefined;

function getS3Client() {
  if (client) return client;

  if (!isObjectStorageConfigured()) {
    throw new Error("对象存储尚未配置。");
  }

  if (getStorageProvider() === "s3") {
    const credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    } = {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    };
    if (process.env.S3_SESSION_TOKEN) {
      credentials.sessionToken = process.env.S3_SESSION_TOKEN;
    }
    client = new S3Client({
      region: process.env.S3_REGION || "ap-shanghai",
      endpoint: requireEnv("S3_ENDPOINT"),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0",
      credentials,
    });
    return client;
  }

  const accountId = requireEnv("R2_ACCOUNT_ID");
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

export async function createPrivateReadUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn },
  );
}

export async function createPrivateUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = 600,
) {
  return getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn },
  );
}

export async function uploadPrivateObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function inspectPrivateObject(key: string): Promise<PrivateObjectMeta> {
  const result = await getS3Client().send(
    new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  return {
    contentLength: result.ContentLength,
    contentType: result.ContentType,
  };
}

export async function deletePrivateObject(key: string) {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}
