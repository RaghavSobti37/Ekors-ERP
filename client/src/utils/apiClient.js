import { getAuthToken } from "./authUtils";

const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) 

if (
  API_BASE_URL === "http://localhost:3000/api" &&
  ((typeof import.meta !== "undefined" && !import.meta.env?.VITE_API_BASE_URL))
) {
  console.warn(
    "apiClient.js: API_BASE_URL is using fallback 'http://localhost:3000/api'. " +
      "Ensure VITE_API_BASE_URL is set in your .env file."
  );
}

const apiClient = async (
  endpoint,
  {
    body,
    method = "GET",
    headers: customHeaders = {},
    responseType = "json",
    params,
    rawResponse = false, // ADDED: Optional flag to return raw response
    ...customConfig
  } = {}
) => {
  const token = getAuthToken();
  const defaultHeaders = {};

  if (!(body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  if (responseType === "json" && !customHeaders["Accept"]) {
    defaultHeaders["Accept"] = "application/json";
  }

  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...customHeaders,
    },
  };

  if (
    body &&
    !(body instanceof FormData) &&
    config.headers["Content-Type"] === "application/json"
  ) {
    config.body = JSON.stringify(body);
  } else if (body) {
    config.body = body;
  }

  let url = `${API_BASE_URL}/${
    endpoint.startsWith("/") ? endpoint.substring(1) : endpoint
  }`;

  if (params) {
    const queryParams = new URLSearchParams(params).toString();
    if (queryParams) url += `?${queryParams}`;
  }

  try {
    const response = await fetch(url, config);

    if (response.status === 204 || (method === "DELETE" && response.ok)) {
      return null; // No Content
    }

    let responseData;

    if (responseType === "blob") {
      responseData = await response.blob();
    } else if (responseType === "text") {
      responseData = await response.text();
    } else {
      responseData = await response.json().catch((err) => {
        console.error(
          `[apiClient] Failed to parse JSON for ${method} ${url}. Status: ${response.status}`,
          err
        );
        if (response.ok) {
          throw new Error("Expected JSON response but got something else.");
        }
        return { message: `Invalid response. Status: ${response.status}` };
      });
    }

    if (!response.ok) {
      const error = new Error(responseData.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = responseData;
      throw error;
    }

    if (rawResponse) {
      return { data: responseData, raw: response };
    }

    return responseData;
  } catch (error) {
    if (!error.status) {
      error.message = `Network error or server unreachable: ${error.message}`;
    }
    throw error;
  }
};

export default apiClient;
