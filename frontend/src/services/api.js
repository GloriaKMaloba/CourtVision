const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export function getAuthToken() {
  return localStorage.getItem("courtvision_token");
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("courtvision_token", token);
  } else {
    localStorage.removeItem("courtvision_token");
  }
}

export function getStoredUser() {
  const userStr = localStorage.getItem("courtvision_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem("courtvision_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("courtvision_user");
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // If body is NOT FormData, default to application/json
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = (data && data.error) || (data && data.message) || response.statusText || "Request failed";
    throw new Error(errorMessage);
  }

  return data;
}

export const api = {
  // Auth
  async login(email, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    setStoredUser(data.user);
    return data;
  },

  async register(registrationData) {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(registrationData),
    });
    setAuthToken(data.token);
    setStoredUser(data.user);
    return data;
  },

  async getMe() {
    const data = await request("/auth/me");
    if (data.user) {
      setStoredUser(data.user);
    }
    return data;
  },

  logout() {
    setAuthToken(null);
    setStoredUser(null);
  },

  // Videos
  async uploadVideo(file, metadata = {}) {
    const formData = new FormData();
    formData.append("video", file);
    if (metadata.title) formData.append("title", metadata.title);
    if (metadata.notes) formData.append("notes", metadata.notes);
    if (metadata.athlete_id) formData.append("athlete_id", metadata.athlete_id);

    return await request("/videos/upload", {
      method: "POST",
      body: formData,
    });
  },

  async getVideos(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.athlete_id) query.append("athlete_id", params.athlete_id);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return await request(`/videos${queryString}`);
  },

  async getVideo(id) {
    return await request(`/videos/${id}`);
  },

  getVideoFileUrl(id) {
    const token = getAuthToken();
    return `${API_BASE_URL}/videos/${id}/file${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },

  async processVideo(id) {
    return await request(`/videos/${id}/process`, {
      method: "POST",
    });
  },

  async deleteVideo(id) {
    return await request(`/videos/${id}`, {
      method: "DELETE",
    });
  },

  // Health
  async getHealth() {
    return await request("/health");
  },
};
