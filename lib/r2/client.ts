import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isR2Configured } from "@/lib/config/backend";

function getR2Config() {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 尚未配置。");
  }

  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
  };
}

let client: S3Client | undefined;

export function getR2Client() {
  const config = getR2Config();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

export async function createPrivateReadUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: getR2Config().bucket, Key: key }),
    { expiresIn },
  );
}

export async function createPrivateUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 600,
) {
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: getR2Config().bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

export async function uploadPrivateObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Config().bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deletePrivateObject(key: string) {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: getR2Config().bucket, Key: key }),
  );
}
