import "server-only";

/**
 * Backward-compatible R2 helpers. Prefer `@/lib/storage/client` for new code.
 * STORAGE_PROVIDER=r2|s3 switches the underlying S3-compatible backend.
 */

export {
  createPrivateReadUrl,
  createPrivateUploadUrl,
  deletePrivateObject,
  inspectPrivateObject,
  uploadPrivateObject,
} from "@/lib/storage/client";

export { isObjectStorageConfigured as isR2Configured } from "@/lib/config/backend";

export function getR2Client(): never {
  throw new Error(
    "getR2Client() 已废弃：请改用 @/lib/storage/client 中的签名/上传辅助函数。",
  );
}
