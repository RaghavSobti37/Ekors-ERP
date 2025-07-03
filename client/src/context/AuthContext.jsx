import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback
} from "react";
import apiClient from "../utils/apiClient"; // Adjust path if apiClient.js is elsewhere
import LoadingSpinner from "../components/LoadingSpinner"; // Import the LoadingSpinner

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
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Removed audit log functionality
  // The audit log functionality has been removed
  const logEventToServer = useCallback(() => {
    // No-op function as replacement
  }, []);

  const login = useCallback(
    async (credentials) => {
      try {
        const authResponseData = await apiClient("/auth/login", {
          method: "POST",
          body: credentials,
        });
        if (authResponseData.token && authResponseData.user) {
          localStorage.setItem("erp-user", authResponseData.token);
          setUser(authResponseData.user);

          // Removed audit logging
          const { firstname, lastname, id, email } = authResponseData.user;
          return authResponseData.user; // Return user for immediate use if needed
        } else {
          throw new Error("Login failed: Invalid server response structure.");
        }
      } catch (error) {
        localStorage.removeItem("erp-user"); // Ensure no partial state
        setUser(null);
        throw error; // Re-throw for the calling component to handle UI updates (e.g., show error message)
      }
    },
    [logEventToServer]
  ); // logEventToServer is memoized

  const logout = useCallback(async () => {
    const currentUserForLog = { ...user }; // Capture user details before nullifying state

    if (user && user.firstname && user.lastname) {
      const { firstname, lastname, id, email } = currentUserForLog;
      logEventToServer({
        // No need to await if it's fire-and-forget
        type: "userActivity",
        message: "User logged out",
        user: { firstname, lastname, id, email },
        details: { event: "USER_LOGOUT", userId: id, userEmail: email },
      });
    } else {
      logEventToServer({
        // No need to await
        type: "userActivity",
        message: "User logged out (anonymous or incomplete data)",
        user: null,
        details: { event: "USER_LOGOUT_ANONYMOUS" },
      });
    }
    localStorage.removeItem("erp-user");
    setUser(null);
    // Optionally: redirect to login page
    // window.location.href = '/login'; // Or use React Router's navigate
  }, [user, logEventToServer]); // user and logEventToServer are dependencies

  const updateUserContext = useCallback((userData) => {
    setUser(userData);
  }, []);

  if (isLoading) {
    // Use LoadingSpinner for initial authentication check
    return <LoadingSpinner show={true} />;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        updateUserContext,
        login,
        logout,
        isLoading,
        // logEventToServer has been removed
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
