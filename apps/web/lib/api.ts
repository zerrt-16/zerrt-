const FALLBACK_API_ORIGIN = "http://localhost:4000";

function normalizeApiBaseUrl(value?: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return `${FALLBACK_API_ORIGIN}/api`;
  }

  const withoutTrailingSlash = trimmedValue.replace(/\/+$/, "");

  if (withoutTrailingSlash.endsWith("/api")) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api`;
}

export function getServerApiBaseUrl() {
  return normalizeApiBaseUrl(
    process.env.API_SERVER_BASE_URL ??
      process.env.API_SERVER_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_URL,
  );
}

export function getClientApiBaseUrl() {
  return normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL,
  );
}

function getApiOrigin(apiBaseUrl: string) {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return FALLBACK_API_ORIGIN;
  }
}

export function resolveAssetUrl(fileUrl: string, apiBaseUrl = getClientApiBaseUrl()) {
  if (!fileUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }

  return `${getApiOrigin(apiBaseUrl)}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
}

export async function readApiErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }

    if (typeof payload.message === "string") {
      return payload.message;
    }
  } catch {
    return `请求失败，状态码 ${response.status}。`;
  }

  return `请求失败，状态码 ${response.status}。`;
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getServerApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`接口请求失败，状态码 ${response.status}。`);
  }

  return (await response.json()) as T;
}
