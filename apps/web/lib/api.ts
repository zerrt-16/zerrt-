const CLIENT_FALLBACK_API_BASE_URL = "/api";
const SERVER_FALLBACK_API_BASE_URL = "http://localhost:4000/api";

function isAbsoluteHttpUrl(value?: string | null) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim().replace(/^\/+/, ""));
}

function normalizeApiBaseUrl(value?: string | null, fallback = CLIENT_FALLBACK_API_BASE_URL) {
  const trimmedValue = value?.trim().replace(/^\/+(?=https?:\/\/)/i, "");

  if (!trimmedValue) {
    return fallback;
  }

  const baseUrl = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : trimmedValue.startsWith("/")
      ? trimmedValue
      : `/${trimmedValue}`;
  const withoutTrailingSlash = baseUrl.replace(/\/+$/, "");

  if (/\/api$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api`;
}

export function getServerApiBaseUrl() {
  const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;

  return normalizeApiBaseUrl(
    process.env.API_SERVER_BASE_URL ??
      process.env.API_SERVER_URL ??
      (isAbsoluteHttpUrl(publicApiBaseUrl) ? publicApiBaseUrl : undefined),
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
  const normalizedPath = path
    .replace(/^\/+/, "")
    .replace(/^api(?:\/|$)/i, "");

  if (!normalizedPath) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl.replace(/\/+$/, "")}/${normalizedPath}`;
}

function parseApiErrorMessage(status: number, responseBody: string) {
  if (!responseBody.trim()) {
    return `请求失败，状态码 ${status}。`;
  }

  try {
    const payload = JSON.parse(responseBody) as { message?: string | string[] };

    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    return responseBody;
  }

  return `请求失败，状态码 ${status}。`;
}

async function readResponseBody(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function logApiError(input: {
  url: string;
  method: string;
  status?: number;
  responseBody?: string;
  error?: unknown;
}) {
  console.error("[api-request-error]", {
    url: input.url,
    method: input.method,
    status: input.status,
    responseBody: input.responseBody,
    error: input.error,
  });
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
  const responseBody = await readResponseBody(response.clone());

  return parseApiErrorMessage(response.status, responseBody);
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
  apiBaseUrl = getClientApiBaseUrl(),
): Promise<T> {
  const url = joinApiUrl(apiBaseUrl, path);
  const method = init?.method ?? "GET";

  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    logApiError({ url, method, error });
    throw error;
  }

  if (!response.ok) {
    const responseBody = await readResponseBody(response.clone());

    logApiError({
      url,
      method,
      status: response.status,
      responseBody,
    });

    throw new Error(parseApiErrorMessage(response.status, responseBody));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinApiUrl(getServerApiBaseUrl(), path);
  const method = init?.method ?? "GET";
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const responseBody = await readResponseBody(response.clone());

    logApiError({
      url,
      method,
      status: response.status,
      responseBody,
    });

    throw new Error(parseApiErrorMessage(response.status, responseBody));
  }

  return (await response.json()) as T;
}
