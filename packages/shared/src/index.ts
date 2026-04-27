export type ApiHealthStatus = {
  status: "ok" | "degraded";
  service: string;
  database: "connected" | "disconnected";
  timestamp: string;
};

export type AppRuntimeConfig = {
  apiBaseUrl: string;
};

export const DEFAULT_WEB_PORT = 3000;
export const DEFAULT_API_PORT = 4000;
