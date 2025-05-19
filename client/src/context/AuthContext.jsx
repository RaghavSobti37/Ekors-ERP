import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("erp-user");
    console.log("[DEBUG] Initializing auth context with stored user:", storedUser);
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const login = (userData) => {
    console.log("[DEBUG] Logging in user:", userData);
    localStorage.setItem("erp-user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    console.log("[DEBUG] Logging out user");
    localStorage.removeItem("erp-user");
    setUser(null);
  };

  useEffect(() => {
    console.log("[DEBUG] Current auth state:", user);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};