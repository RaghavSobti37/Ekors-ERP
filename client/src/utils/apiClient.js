const BASE_URL = import.meta.env.VITE_API_BASE_URL; // User sets this to https://erp-backend-n2mu.onrender.com in Vercel

const apiClient = async (endpoint, options = {}) => {
  const { body, method = 'GET', headers = {}, isFormData, rawResponse, ...customConfig } = options;

  const token = localStorage.getItem("erp-user");
  const config = {
    method: method,
    ...customConfig, // Spread other custom fetch options
    headers: {
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
    }
  }

  // Make the request
  const response = await fetch(requestUrl, config);

  // Handle raw response if requested (e.g., for file downloads/previews)
  if (rawResponse) {
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: response.statusText || errorText };
      }
      const error = new Error(errorData.message || `API request failed for ${requestUrl}`);
      error.status = response.status;
      error.data = errorData;
      console.error(`[apiClient] Error for ${method} ${requestUrl}: ${error.status}`, error.data);
      throw error;
    }
    return response; // Return the raw Response object
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