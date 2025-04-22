export const useAuthToken = () => {
    const getAuthToken = () => {
      try {
        const userData = JSON.parse(localStorage.getItem("erp-user"));
        if (!userData || typeof userData !== "object") {
          return null;
        }
        return userData.token;
      } catch (e) {
        console.error("Failed to parse user data:", e);
        return null;
      }
    };
  
    return { getAuthToken };
  };