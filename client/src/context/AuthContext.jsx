import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import apiClient from "../utils/apiClient"; // Adjust path if apiClient.js is elsewhere

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // For initial auth check

  // Function to fetch current user details if token exists
  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem("erp-user");
    if (token) {
      try {
        const data = await apiClient("/auth/verify"); // Changed to /auth/verify to match server route
        setUser(data.user || data); // Adjust based on your /me endpoint response
      } catch (error) {
        localStorage.removeItem("erp-user"); // Token is invalid or expired
        setUser(null);
      }
    } else {
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const logEventToServer = async (logData) => {
    const payload = { level: "info", ...logData };
    try {
      // apiClient handles token and base URL
      const responseData = await apiClient("/audit/log", {
        method: "POST",
        body: payload,
      });
      // console.log("[DEBUG Client AuthContext] logEventToServer: Success.", responseData); // Optional: log success
    } catch (error) {
      console.error(
        "[DEBUG Client AuthContext] logEventToServer: Failed.",
        error.message,
        error.data || error
      );
    }
  };

  const login = async (credentials) => {
    try {
      const authResponseData = await apiClient("/auth/login", {
        method: "POST",
        body: credentials,
      });
      if (authResponseData.token && authResponseData.user) {
        localStorage.setItem("erp-user", authResponseData.token);
        setUser(authResponseData.user);

        const { firstname, lastname, id, email } = authResponseData.user;
        logEventToServer({
          type: "userActivity",
          message: "User logged in",
          user: { firstname, lastname, id, email },
          details: { event: "USER_LOGIN", userId: id, userEmail: email },
        });
        return authResponseData.user; // Return user for immediate use if needed
      } else {
        console.error(
          "[DEBUG Client AuthContext] login: Failed. Token or user data missing in server response.",
          authResponseData
        );
        throw new Error("Login failed: Invalid server response structure.");
      }
    } catch (error) {
      console.error(
        "[DEBUG Client AuthContext] login: Failed.",
        error.message,
        error.data || error
      );
      localStorage.removeItem("erp-user"); // Ensure no partial state
      setUser(null);
      throw error; // Re-throw for the calling component to handle UI updates (e.g., show error message)
    }
  };

  const logout = async () => {
    const currentUserForLog = { ...user }; // Capture user details before nullifying state
    console.log(
      "[DEBUG Client AuthContext] logout: Initiating logout for user:",
      currentUserForLog ? currentUserForLog.email : "No user in state"
    );

    if (user && user.firstname && user.lastname) {
      const { firstname, lastname, id, email } = currentUserForLog;
      await logEventToServer({
        type: "userActivity",
        message: "User logged out",
        user: { firstname, lastname, id, email },
        details: { event: "USER_LOGOUT", userId: id, userEmail: email },
      });
    } else {
      console.warn(
        "[DEBUG Client AuthContext] logout: User data incomplete or user not found, attempting anonymous server log for logout event."
      );
      await logEventToServer({
        type: "userActivity",
        message: "User logged out (anonymous or incomplete data)",
        user: null,
        details: { event: "USER_LOGOUT_ANONYMOUS" },
      });
    }

    localStorage.removeItem("erp-user");
    setUser(null);
    console.log(
      "[DEBUG Client AuthContext] logout: Removed 'erp-user' from localStorage."
    );
    console.log("[DEBUG Client AuthContext] logout: User state set to null.");
    // Optionally: redirect to login page
    // window.location.href = '/login'; // Or use React Router's navigate
  };

  const updateUserContext = (userData) => {
    setUser(userData);
  };

  if (isLoading) {
    return <div>Loading authentication...</div>; // Or your custom loading component
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        updateUserContext,
        login,
        logout,
        isLoading,
        fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Stricter check for context availability
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
