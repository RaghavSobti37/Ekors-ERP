export const useAuthToken = () => {
    const getAuthToken = () => {
      // localStorage 'erp-user' now stores only the token string directly
      const token = localStorage.getItem("erp-user");
      console.log("[DEBUG Client useAuthToken] getAuthToken retrieved:", token ? "Token present" : "No token");
      return token || null;
    };
  
    return { getAuthToken };
  };