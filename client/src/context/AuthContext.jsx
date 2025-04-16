import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("erp-user")) || null
  );

  const login = (data) => {
    localStorage.setItem("erp-user", JSON.stringify(data));
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem("erp-user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
