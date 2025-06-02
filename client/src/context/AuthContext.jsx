import { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "../utils/apiClient"; // Adjust path if apiClient.js is elsewhere

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // For initial auth check

  // Function to fetch current user details if token exists
  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem("erp-user");
    if (token) {
      console.log("[DEBUG Client AuthContext] Token found. Attempting to fetch current user.");
      try {
        const data = await apiClient("/auth/verify"); // Changed to /auth/verify to match server route
        setUser(data.user || data); // Adjust based on your /me endpoint response
        console.log("[DEBUG Client AuthContext] Current user fetched successfully:", data.user || data);
      } catch (error) {
        console.error("[DEBUG Client AuthContext] Failed to fetch current user or token invalid:", error.message);
        localStorage.removeItem("erp-user"); // Token is invalid or expired
        setUser(null);
      }
    } else {
      console.log("[DEBUG Client AuthContext] No token found in localStorage for auto-login.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    console.log("[DEBUG Client AuthContext] AuthProvider mounted. Fetching current user...");
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const logEventToServer = async (logData) => {
    const payload = { level: 'info', ...logData };
    console.log("[DEBUG Client AuthContext] logEventToServer: Attempting to send log:", JSON.stringify(payload, null, 2));
    try {
      // apiClient handles token and base URL
      const responseData = await apiClient("/audit/log", { method: 'POST', body: payload });
      console.log("[DEBUG Client AuthContext] logEventToServer: Log successfully sent. Server Response:", responseData);
    } catch (error) {
      // apiClient already logs details, but you can add more specific handling here
      console.error("[DEBUG Client AuthContext] logEventToServer: Error sending log:", error.message, error.data || error);
    }
  };

  // Login function expects credentials (e.g., { email, password })
  // It should call your server's login endpoint (e.g., POST /api/auth/login)
  // The server should respond with { token: "your_jwt_token", user: { id, firstname, ... } }
  const login = async (credentials) => {
    console.log("[DEBUG Client AuthContext] login: Attempting login for:", credentials.email);
    try {
      const authResponseData = await apiClient("/auth/login", { method: 'POST', body: credentials });
      if (authResponseData.token && authResponseData.user) {
        localStorage.setItem("erp-user", authResponseData.token);
        setUser(authResponseData.user);
        console.log("[DEBUG Client AuthContext] login: Successful. User set, token stored.", authResponseData.user);

        const { firstname, lastname, id, email } = authResponseData.user;
        logEventToServer({
          type: 'userActivity',
          message: 'User logged in',
          user: { firstname, lastname, id, email },
          details: { event: 'USER_LOGIN', userId: id, userEmail: email }
        });
        return authResponseData.user; // Return user for immediate use if needed
      } else {
        console.error("[DEBUG Client AuthContext] login: Failed. Token or user data missing in server response.", authResponseData);
        throw new Error("Login failed: Invalid server response structure.");
      }
    } catch (error) {
      console.error("[DEBUG Client AuthContext] login: Failed.", error.message, error.data || error);
      localStorage.removeItem("erp-user"); // Ensure no partial state
      setUser(null);
      throw error; // Re-throw for the calling component to handle UI updates (e.g., show error message)
    }
  };

  const logout = async () => {
    const currentUserForLog = { ...user }; // Capture user details before nullifying state
    console.log("[DEBUG Client AuthContext] logout: Initiating logout for user:", currentUserForLog ? currentUserForLog.email : "No user in state");

    if (user && user.firstname && user.lastname) {
      const { firstname, lastname, id, email } = currentUserForLog;
      await logEventToServer({
        type: 'userActivity',
        message: 'User logged out',
        user: { firstname, lastname, id, email },
        details: { event: 'USER_LOGOUT', userId: id, userEmail: email }
      });
    } else {
      console.warn("[DEBUG Client AuthContext] logout: User data incomplete or user not found, attempting anonymous server log for logout event.");
      await logEventToServer({ type: 'userActivity', message: 'User logged out (anonymous or incomplete data)', user: null, details: { event: 'USER_LOGOUT_ANONYMOUS' } });
    }

    localStorage.removeItem("erp-user");
    setUser(null);
    console.log("[DEBUG Client AuthContext] logout: Removed 'erp-user' from localStorage.");
    console.log("[DEBUG Client AuthContext] logout: User state set to null.");
    // Optionally: redirect to login page
    // window.location.href = '/login'; // Or use React Router's navigate
  };

  useEffect(() => {
    console.log("[DEBUG Client AuthContext] Auth state changed. Current user:", user ? user.email : null);
  }, [user]);

  if (isLoading) {
    console.log("[DEBUG Client AuthContext] Initial auth check in progress...");
    // Render a loading indicator or null while checking auth status
    // This prevents rendering parts of your app that depend on auth state prematurely
    return <div>Loading authentication...</div>; // Or your custom loading component
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) { // Stricter check for context availability
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};