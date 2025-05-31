const API_BASE_URL = 'https://ekors-erp.onrender.com/api';

const apiClient = async (endpoint, { body, method = 'GET', ...customConfig } = {}) => {
  const token = localStorage.getItem('erp-user');
  const headers = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method: method,
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  console.log(`[DEBUG Client apiClient] Requesting: ${method} ${API_BASE_URL}${endpoint}`, { tokenPresent: !!token });

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (response.status === 204) { // No Content
      console.log(`[DEBUG Client apiClient] Response: ${response.status} No Content for ${method} ${API_BASE_URL}${endpoint}`);
      return null;
    }

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`[DEBUG Client apiClient] API Error: ${response.status} for ${method} ${API_BASE_URL}${endpoint}`, responseData);
      const error = new Error(responseData.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = responseData;
      throw error;
    }
    console.log(`[DEBUG Client apiClient] Response: ${response.status} for ${method} ${API_BASE_URL}${endpoint}`, responseData);
    return responseData;
  } catch (error) {
    console.error(`[DEBUG Client apiClient] Network or other error for ${method} ${API_BASE_URL}${endpoint}:`, error.message, error.data || error);
    throw error; // Re-throw for the calling component/function to handle
  }
};

export default apiClient;