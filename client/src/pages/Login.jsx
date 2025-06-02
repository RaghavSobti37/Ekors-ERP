import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import { FaEye, FaEyeSlash } from "react-icons/fa"; // Icons for password visibility
import { useAuth } from "../context/AuthContext"; // Authentication context
import "../css/Style.css"; // General styles

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate(); 
  const auth = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("[DEBUG Client Login.jsx] Login attempt with:", { email });
    setError("");

    try {
      await auth.login({ email, password }); 
      console.log("[DEBUG Client Login.jsx] Auth context login successful, navigating to /quotations");
      navigate("/quotations");

    } catch (err) {
      console.error("[ERROR Client Login.jsx] Login failed:", err.data?.error || err.message || "An unknown error occurred");
      setError(err.data?.error || err.data?.message || err.message || "Invalid email or password. Please try again.");
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
      </div>
    </div>
  );
}