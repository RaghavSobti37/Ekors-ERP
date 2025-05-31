import { getAuthToken } from "./authUtils";

// Environment variable for API Base URL
// For Vercel, set VITE_API_BASE_URL (or REACT_APP_API_BASE_URL/NEXT_PUBLIC_API_BASE_URL)
// to: https://e6f7-2401-4900-1f2e-8fff-00-87-347e.ngrok-free.app/api
const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_BASE_URL) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:3000/api"; // Fallback: assumes backend runs on 3000 and API routes are under /api

if (
  API_BASE_URL === "http://localhost:3000/api" &&
  ((typeof import.meta !== "undefined" && !import.meta.env?.VITE_API_BASE_URL) &&
  (typeof process !== "undefined" && !process.env?.REACT_APP_API_BASE_URL) &&
  (typeof process !== "undefined" && !process.env?.NEXT_PUBLIC_API_BASE_URL))
) {
  console.warn(
    "apiClient.js: API_BASE_URL is using fallback 'http://localhost:3000/api'. " +
      "Ensure VITE_API_BASE_URL, REACT_APP_API_BASE_URL, or NEXT_PUBLIC_API_BASE_URL is set in your .env file for proper configuration."
  );
}

const apiClient = async (
  endpoint,
  {
    body,
    method = "GET",
    headers: customHeaders = {},
    responseType = "json",
    params, // New option for query parameters
    ...customConfig
  } = {}
) => {
  const token = getAuthToken(); // Use the utility
  const defaultHeaders = {};

  // Don't set Content-Type if body is FormData, browser will set it with boundary
  if (!(body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }
  // Accept JSON by default, can be overridden by customHeaders
  if (responseType === "json" && !customHeaders["Accept"]) {
    defaultHeaders["Accept"] = "application/json";
  }
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method: method,
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...customConfig.headers,
    },
  };

  // Only stringify body if it's not FormData and Content-Type is application/json
  if (
    body &&
    !(body instanceof FormData) &&
    config.headers["Content-Type"] === "application/json"
  ) {
    config.body = JSON.stringify(body);
  } else if (body) {
    // For FormData or other types (e.g. raw string for text/plain)
    config.body = body;
  }

  let url = `${API_BASE_URL}/${
    endpoint.startsWith("/") ? endpoint.substring(1) : endpoint
  }`;

  if (params) {
    const queryParams = new URLSearchParams(params).toString();
    if (queryParams) {
      url += `?${queryParams}`;
    }
  }
  // console.log(
  //   `[DEBUG Client apiClient] Requesting: ${method} ${url}`,
  //   { tokenPresent: !!token, requestConfig: config }
  // );

  try {
    const response = await fetch(url, config);

    if (response.status === 204) {
      // No Content
      // console.log(
      //   `[DEBUG Client apiClient] Response: ${response.status} No Content for ${method} ${url}`
      // );
      return null;
    }

    // Handle different response types
    let responseData;
    if (responseType === "blob") {
      responseData = await response.blob();
    } else if (responseType === "text") {
      responseData = await response.text();
    } else {
      // Default to json
      responseData = await response.json().catch((err) => {
        // Handle cases where response is not valid JSON but status is ok (e.g. server error page)
        console.error(
          `[DEBUG Client apiClient] Failed to parse JSON for ${method} ${url}. Status: ${response.status}`,
          err
        );
        // If response.ok is true but JSON parsing fails, it's an issue.
        // If response.ok is false, this error will be caught by the block below.
        if (response.ok)
          throw new Error(
            "Received non-JSON response from server when JSON was expected."
          );
        return {
          message: `Server returned non-JSON error. Status: ${response.status}`,
        }; // Provide a fallback error object
      });
    }

    if (!response.ok) {
      // console.error(`[DEBUG Client apiClient] API Error: ${response.status} for ${method} ${url}`, responseData);
      let errorMessage = `Request failed with status ${response.status}`;
      if (
        responseData &&
        typeof responseData === "object" &&
        responseData.message
      ) {
        // Check if responseData is an object and has message
        errorMessage = responseData.message;
      } else if (typeof responseData === "string") {
        // If responseData is a string (e.g. from text response or parse failure)
        errorMessage = responseData;
      } else if (response.statusText) {
        errorMessage = response.statusText;
      }
      const error = new Error(errorMessage);

      error.status = response.status;
      error.data = responseData;
      throw error;
    }
    // console.log(
    //   `[DEBUG Client apiClient] Response: ${response.status} for ${method} ${url}`,
    //   responseData
    // );
    return responseData;
  } catch (error) {
    // console.error(
    //   `[DEBUG Client apiClient] Network or other error for ${method} ${url}:`,
    //   error.message,
    //   error.data || error
    // );
    if (!error.status) {
      // Generic network error not thrown by the above block
      error.message = `Network error or server unreachable: ${error.message}`;
    }
    throw error; // Re-throw for the calling component/function to handle
  }
};
export default apiClient;
