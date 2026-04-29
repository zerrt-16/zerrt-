const API_PREFIX = "/api";
const DEFAULT_BROWSER_API_BASE_URL = API_PREFIX;
const DEFAULT_SERVER_API_BASE_URL = "http://api:4000";

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function removeTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function withoutTrailingApi(value: string) {
  return removeTrailingSlash(value).replace(/\/api$/i, "");
}

export function normalizeApiPath(path: string) {
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.search}`;
    } catch {
      return "";
    }
  }

  const clean = trimSlashes(path);

  return clean.replace(/^api(?:\/|$)/i, "");
}

export function getClientApiBaseUrl() {
  return DEFAULT_BROWSER_API_BASE_URL;
}

export function getServerApiBaseUrl() {
  const serverBaseUrl = process.env.API_SERVER_BASE_URL?.trim() || DEFAULT_SERVER_API_BASE_URL;

  return `${withoutTrailingApi(serverBaseUrl)}${API_PREFIX}`;
}

function getApiBaseUrl() {
  return typeof window === "undefined" ? getServerApiBaseUrl() : getClientApiBaseUrl();
}

export function joinApiUrl(apiBaseUrl: string, path: string) {
  const normalizedPath = normalizeApiPath(path);
  const normalizedBaseUrl = /^https?:\/\//i.test(apiBaseUrl)
    ? `${withoutTrailingApi(apiBaseUrl)}${API_PREFIX}`
    : removeTrailingSlash(apiBaseUrl);

  if (!normalizedPath) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/${normalizedPath}`;
}

export function getApiUrl(path: string) {
  return joinApiUrl(getApiBaseUrl(), path);
}

function parseApiErrorMessage(status: number, _responseBody: string) {
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
    responseBody: input.responseBody?.slice(0, 500),
    error: input.error,
  });
}

export function resolveAssetUrl(fileUrl: string) {
  if (!fileUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }

  return fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
}

export async function readApiErrorMessage(response: Response) {
  const responseBody = await readResponseBody(response.clone());

  return parseApiErrorMessage(response.status, responseBody);
}

export async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = getApiUrl(path);
  const method = init?.method ?? "GET";

  let response: Response;

  console.log("[api-request]", { url, method });

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
  return requestApi<T>(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
