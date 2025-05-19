import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate(); 
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("[DEBUG] Login attempt with:", { email, password });
    setError("");

    try {
      console.log("[DEBUG] Sending login request to server...");
      const response = await axios.post("http://localhost:3000/api/auth/login", {
        email,
        password,
      });
      
      console.log("[DEBUG] Server response:", response.data);
      
      if (!response.data.token || !response.data.user) {
        throw new Error("Invalid response from server");
      }

      const { token, user } = response.data;
      
      // Set auth header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log("[DEBUG] Auth header set with token");
      
      // Update auth context
      login({ ...user, token });
      console.log("[DEBUG] User logged in successfully, navigating to dashboard");
      
      navigate("/quotations");

    } catch (err) {
      console.error("[ERROR] Login failed:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Invalid email or password");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="card p-4 shadow-lg" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Login</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-outline mb-3">
            <input
              type="email"
              placeholder="Email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-outline mb-3 position-relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn position-absolute"
              style={{ right: "10px", top: "50%", transform: "translateY(-50%)" }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-block w-100">
            Sign In
          </button>
        </form>
        <p className="text-center mt-3">
          Don't have an account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  );
}