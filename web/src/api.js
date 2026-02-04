function normalizeBase(base) {
  if (!base || base === "/") return "";
  if (base.endsWith("/")) return base.slice(0, -1);
  return base;
}

const rawBase = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const isProd = import.meta.env.PROD;
const shouldIgnoreLocalhost =
  isProd && /^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/.test(rawBase);

export const API_BASE = normalizeBase(shouldIgnoreLocalhost ? "" : rawBase);

export function setToken(t) {
  localStorage.setItem("token", t || "");
}
export function getToken() {
  return localStorage.getItem("token") || "";
}

export async function fetchWithAuth(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

export async function openSecureFile(path) {
  if (!path) return;
  const res = await fetchWithAuth(path);
  if (!res.ok) throw new Error("Request failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload;
  if (body) {
    if (isForm) {
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  login: (username, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    }),
  seed: (adminPwd, studentPwd) =>
    request("/api/auth/seed", {
      method: "POST",
      body: { adminPwd, studentPwd },
    }),

  getDay: (day) => request(`/api/days/${day}`),
  saveDay: (day, payload) =>
    request(`/api/days/${day}`, { method: "PUT", body: payload }),
  addNote: (day, formData) =>
    request(`/api/days/${day}/notes`, {
      method: "POST",
      body: formData,
      isForm: true,
    }),
  delNote: (id) => request(`/api/days/notes/${id}`, { method: "DELETE" }),
  settle: (day) => request(`/api/days/${day}/settle`, { method: "POST" }),
  myBalance: () => request(`/api/days/balance/me`),

  listUploads: (day, { page = 1, pageSize = 8 } = {}) =>
    request(`/api/uploads/${day}?page=${page}&pageSize=${pageSize}`),
  upload: (day, formData) =>
    request(`/api/uploads/${day}`, {
      method: "POST",
      body: formData,
      isForm: true,
    }),

  redeem: (minutes, note) =>
    request(`/api/redeem`, { method: "POST", body: { minutes, note } }),
  redeemHistory: () => request(`/api/redeem/history/me`),

  adminGetDay: (day) => request(`/api/admin/days/${day}`),
  adminCheck: (day, checked) =>
    request(`/api/admin/days/${day}/check`, {
      method: "POST",
      body: { checked },
    }),
  adminUploads: (day, { page = 1, pageSize = 9 } = {}) =>
    request(`/api/admin/uploads/${day}?page=${page}&pageSize=${pageSize}`),
  adminAdjust: (minutes, note, day) =>
    request(`/api/admin/ledger/adjust`, {
      method: "POST",
      body: { minutes, note, day },
    }),
};
