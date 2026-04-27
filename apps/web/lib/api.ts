const CLIENT_FALLBACK_API_BASE_URL = "/api";
const SERVER_FALLBACK_API_BASE_URL =
  process.env.NODE_ENV === "production" ? "/api" : "http://localhost:4000/api";

function normalizeApiBaseUrl(value?: string | null, fallback = CLIENT_FALLBACK_API_BASE_URL) {
  const trimmedValue = value?.trim().replace(/^\/+(https?:\/\/)/i, "$1");

  if (!trimmedValue) {
    return fallback;
  }

  const withLeadingSlash =
    /^https?:\/\//i.test(trimmedValue) || trimmedValue.startsWith("/")
      ? trimmedValue
      : `/${trimmedValue}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");

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
    SERVER_FALLBACK_API_BASE_URL,
  );
}

export function getClientApiBaseUrl() {
  return normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL,
    CLIENT_FALLBACK_API_BASE_URL,
  );
}

function getApiOrigin(apiBaseUrl: string) {
  if (!/^https?:\/\//i.test(apiBaseUrl)) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }

  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "";
  }
}

export function joinApiUrl(apiBaseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl.replace(/\/+$/, "")}${normalizedPath}`;
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
  const response = await fetch(joinApiUrl(getServerApiBaseUrl(), path), {
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
