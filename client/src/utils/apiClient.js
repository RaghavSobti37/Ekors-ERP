<<<<<<< HEAD
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
=======
const BASE_URL = import.meta.env.VITE_API_BASE_URL; // User sets this to https://erp-backend-n2mu.onrender.com in Vercel

const apiClient = async (endpoint, options = {}) => {
  const { body, method = 'GET', headers = {}, isFormData, rawResponse, ...customConfig } = options;
>>>>>>> e24766db557916714610528af9dff9872e3a0639

  const token = localStorage.getItem("erp-user");
  const config = {
    method: method,
    ...customConfig, // Spread other custom fetch options
    headers: {
<<<<<<< HEAD
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
=======
      ...headers, // Spread custom headers
    },
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // BASE_URL already contains /api, and endpoint is the path relative to that.
  const requestUrl = `${BASE_URL}${endpoint}`;

  // Handle body content: JSON or FormData
  if (options.formData) { // If formData is explicitly passed in options (e.g. for file uploads in Tickets.jsx)
    config.body = options.formData;
    // Content-Type for FormData is set by the browser
  } else if (body) { // If a 'body' property is passed in options
    if (isFormData || body instanceof FormData) { // Check isFormData flag or if body is FormData instance (e.g. Items.jsx Excel upload)
      config.body = body;
      // Content-Type for FormData is set by the browser
    } else { // Assume JSON
      config.body = JSON.stringify(body);
      config.headers['Content-Type'] = 'application/json';
>>>>>>> e24766db557916714610528af9dff9872e3a0639
    }
  }

<<<<<<< HEAD
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
=======
  // Make the request
  const response = await fetch(requestUrl, config);
>>>>>>> e24766db557916714610528af9dff9872e3a0639

  // Handle raw response if requested (e.g., for file downloads/previews)
  if (rawResponse) {
    if (!response.ok) {
<<<<<<< HEAD
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

=======
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: response.statusText || errorText };
      }
      const error = new Error(errorData.message || `API request failed for ${requestUrl}`);
>>>>>>> e24766db557916714610528af9dff9872e3a0639
      error.status = response.status;
      error.data = errorData;
      console.error(`[apiClient] Error for ${method} ${requestUrl}: ${error.status}`, error.data);
      throw error;
    }
<<<<<<< HEAD
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
=======
    return response; // Return the raw Response object
>>>>>>> e24766db557916714610528af9dff9872e3a0639
  }

  // Standard JSON response handling
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    const error = new Error(errorData.message || `API request failed for ${requestUrl}`);
    error.status = response.status;
    error.data = errorData;
    console.error(`[apiClient] Error for ${method} ${requestUrl}: ${error.status}`, error.data);
    throw error;
  }

  // Handle successful responses that might not have a body (e.g., 204 No Content)
  if (response.status === 204 || (method === 'DELETE' && response.ok)) {
    return; 
  }
  
  return response.json(); // Parse and return JSON data
};
export default apiClient;
