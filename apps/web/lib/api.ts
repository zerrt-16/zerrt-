const API_BASE_URL = "/api";

function normalizeApiPath(path: string) {
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.search}`;
    } catch {
      return API_BASE_URL;
    }
  }

  const normalizedPath = path
    .trim()
    .replace(/^\/+/, "")
    .replace(/^api(?:\/|$)/i, "");

  if (!normalizedPath) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}/${normalizedPath}`;
}

export function getServerApiBaseUrl() {
  return API_BASE_URL;
}

export function getClientApiBaseUrl() {
  return API_BASE_URL;
}

export function joinApiUrl(_apiBaseUrl: string, path: string) {
  return normalizeApiPath(path);
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
  const url = normalizeApiPath(path);
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
  return requestApi<T>(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
