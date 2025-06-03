const BASE_URL = import.meta.env.VITE_API_BASE_URL; 

const apiClient = async (endpoint, options = {}) => {
  const { body, method = 'GET', headers = {}, isFormData, rawResponse, ...customConfig } = options;

  const token = localStorage.getItem("erp-user");
  const config = {
    method: method,
    ...customConfig, 
    headers: {
      ...headers,
    },
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  const requestUrl = `${BASE_URL}${endpoint}`;

  if (options.formData) { 
    config.body = options.formData;
  } else if (body) { 
    if (isFormData || body instanceof FormData) {
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

  if (response.status === 204 || (method === 'DELETE' && response.ok)) {
    return; 
  }
  
  return response.json(); // Parse and return JSON data
};

export default apiClient;