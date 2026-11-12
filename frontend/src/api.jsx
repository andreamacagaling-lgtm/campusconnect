import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

let refreshPromise = null;

function getAuthStorage() {
  return localStorage.getItem("campusconnect_refresh_token") ||
    localStorage.getItem("campusconnect_token")
    ? localStorage
    : sessionStorage;
}

export function getAccessToken() {
  return (
    localStorage.getItem("campusconnect_token") ||
    sessionStorage.getItem("campusconnect_token")
  );
}

export function hasRefreshToken() {
  return Boolean(
    localStorage.getItem("campusconnect_refresh_token") ||
      sessionStorage.getItem("campusconnect_refresh_token")
  );
}

export async function refreshAuthSession() {
  if (refreshPromise) return refreshPromise;

  const storage = getAuthStorage();
  const refreshToken = storage.getItem("campusconnect_refresh_token");
  if (!refreshToken) {
    throw new Error("No refresh token is available.");
  }

  refreshPromise = refreshClient
    .post("/auth/refresh", { refresh_token: refreshToken })
    .then(({ data }) => {
      if (!data?.access_token || !data?.refresh_token) {
        throw new Error("The session refresh response was incomplete.");
      }

      storage.setItem("campusconnect_token", data.access_token);
      storage.setItem("campusconnect_refresh_token", data.refresh_token);
      return data.access_token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

function isApiRequest(config) {
  const url = config?.url || "";
  const baseURL = config?.baseURL || "";
  return (
    url.startsWith("/api/") ||
    url.startsWith("api/") ||
    url.includes("/api/") ||
    baseURL.includes("/api")
  );
}

function addRefreshInterceptor(client) {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const request = error.config;
      if (
        error.response?.status !== 401 ||
        !request ||
        request._sessionRefreshRetry ||
        !isApiRequest(request)
      ) {
        return Promise.reject(error);
      }

      request._sessionRefreshRetry = true;
      try {
        const token = await refreshAuthSession();
        request.headers = request.headers || {};
        request.headers.Authorization = `Bearer ${token}`;
        return client(request);
      } catch (refreshError) {
        console.warn("Unable to refresh an expired API session.", refreshError);
        return Promise.reject(error);
      }
    }
  );
}

addRefreshInterceptor(api);
addRefreshInterceptor(axios);

export default api;
