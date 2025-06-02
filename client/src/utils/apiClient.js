const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = async (endpoint, { body, method = 'GET', ...customConfig } = {}) => {
  const token = localStorage.getItem('erp-user');
  
  // Initialize headers. Start with custom headers from the call, then add Authorization.
  // Content-Type will be handled based on the body.
  const requestHeaders = { ...(customConfig.headers || {}) };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method: method,
    ...customConfig, // Spread other custom configurations
    headers: requestHeaders, // Set headers here
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
      // For FormData, the browser sets the Content-Type header automatically.
      // We must remove any 'Content-Type' header that might have been set,
      // especially if it was 'application/json'.
      delete requestHeaders['Content-Type'];
    } else {
      config.body = JSON.stringify(body);
      // For non-FormData, set 'Content-Type': 'application/json' if not already set.
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }
  }
  // Update config.headers in case they were modified (e.g., Content-Type added/deleted)
  config.headers = requestHeaders;

  console.log(`[DEBUG Client apiClient] Requesting: ${method} ${API_BASE_URL}${endpoint}`, { tokenPresent: !!token, headers: config.headers, bodyUsed: !!body });

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // If response is not OK, try to parse error data, then throw
    if (!response.ok) {
      let errorData;
      const errorContentType = response.headers.get("content-type");
      if (errorContentType && errorContentType.includes("application/json")) {
        try {
          errorData = await response.json();
        } catch (e) {
          // If parsing JSON fails, use the text content
          errorData = { message: await response.text() };
        }
      } else {
        errorData = { message: await response.text() };
      }
      console.error(`[DEBUG Client apiClient] API Error: ${response.status} for ${method} ${API_BASE_URL}${endpoint}`, errorData);
      const message = (errorData && errorData.message) ? String(errorData.message) : `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // Handle successful responses
    if (response.status === 204) { // No Content
      console.log(`[DEBUG Client apiClient] Response: ${response.status} No Content for ${method} ${API_BASE_URL}${endpoint}`);
      return null;
    }

    const successContentType = response.headers.get("content-type");
    if (successContentType && successContentType.includes("application/json")) {
      const responseData = await response.json();
      console.log(`[DEBUG Client apiClient] Response: ${response.status} for ${method} ${API_BASE_URL}${endpoint}`, responseData);
      return responseData;
    } else {
      // For non-JSON successful responses (e.g., file blobs, text), return the raw response object.
      // The caller will then be responsible for response.blob(), response.text(), etc.
      console.log(`[DEBUG Client apiClient] Response: ${response.status} (Non-JSON) for ${method} ${API_BASE_URL}${endpoint}. Returning raw response.`);
      return response;
    }

  } catch (error) {
    // This catches errors from fetch itself (network errors) or errors thrown above.
    console.error(`[DEBUG Client apiClient] Network or other error for ${method} ${API_BASE_URL}${endpoint}:`, error.message, error.data || error);
    if (error instanceof Error) {
        // If it's already a structured error (e.g., from the !response.ok block), rethrow it.
        // Otherwise, wrap it to ensure it's an Error instance.
        if (!error.status && error.data === undefined && !(error.message && error.message.startsWith("Request failed with status"))) {
            const newError = new Error(error.message || 'Network error or an unexpected issue occurred.');
            // Copy status and data if they somehow exist, though unlikely for pure network errors
            if (error.status) newError.status = error.status;
            if (error.data) newError.data = error.data;
            throw newError;
        }
        throw error;
    } else {
        // If what was caught is not an Error instance (e.g., a string was thrown somewhere)
        const newError = new Error(String(error) || 'An unexpected error occurred.');
        throw newError;
    }
  }
};

export default apiClient;
