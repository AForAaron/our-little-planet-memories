type ApiErrorPayload = {
  error?: unknown;
};

const LOGIN_EXPIRED_MESSAGE = "登录已失效，请刷新页面并重新登录。";

function errorMessage(payload: unknown) {
  if (
    payload
    && typeof payload === "object"
    && "error" in payload
    && typeof (payload as ApiErrorPayload).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return "";
}

export async function readApiJson<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  if (response.redirected) {
    throw new Error(LOGIN_EXPIRED_MESSAGE);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      response.status === 401
        ? LOGIN_EXPIRED_MESSAGE
        : `${fallback}服务器返回了无法识别的响应（HTTP ${response.status}）。`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${fallback}服务器返回的数据不完整。`);
  }

  if (!response.ok) {
    throw new Error(
      errorMessage(payload)
      || (response.status === 401
        ? LOGIN_EXPIRED_MESSAGE
        : `${fallback}（HTTP ${response.status}）`),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error(`${fallback}服务器返回的数据格式不正确。`);
  }

  return payload as T;
}
