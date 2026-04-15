import type { StreamEvent } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function normalizeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: { msg?: string }) => e.msg || "Validation error").join(". ");
  }
  return "Request failed";
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public requestId?: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;
  const authHeaders = await getAuthHeaders();

  const config: RequestInit = {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...customHeaders,
    },
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "An unexpected error occurred",
    }));

    throw new ApiError(
      response.status,
      normalizeDetail(error.detail),
      error.request_id,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PUT", body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body }),

  /**
   * Legacy simple stream — yields raw token strings.
   */
  stream: async function* (endpoint: string, body: unknown) {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Stream request failed",
      }));
      throw new ApiError(response.status, normalizeDetail(error.detail));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token !== undefined) yield parsed.token as string;
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /**
   * Rich event stream — yields typed StreamEvent objects.
   */
  streamEvents: async function* (endpoint: string, body: unknown): AsyncGenerator<StreamEvent> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Stream request failed",
      }));
      throw new ApiError(response.status, normalizeDetail(error.detail));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          try {
            const parsed = JSON.parse(payload) as StreamEvent;
            yield parsed;
            if (parsed.type === "done") return;
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  uploadFile: async <T>(endpoint: string, file: File, fieldName = "file") => {
    const authHeaders = await getAuthHeaders();
    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { ...authHeaders },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Upload failed",
      }));
      throw new ApiError(response.status, normalizeDetail(error.detail));
    }

    return response.json() as Promise<T>;
  },
};
