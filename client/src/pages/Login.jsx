import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import "../css/Style.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await auth.login({ email, password });
      navigate("/quotations");
    } catch (err) {
      setError(err.data?.error || err.data?.message || err.message || "Invalid credentials");
    }
  };

  return (
    <div className="login-container">
      {/* Left Description Section - Hidden on mobile */}
      <div className="login-description-section">
        <div className="login-description-content">
          <img
            src="/logo.png"
            alt="Logo"
            className="login-logo"
          />
          <h1 className="login-title">E-KORS Platform</h1>

          {/* Feature Grid */}
          <div className="feature-grid">
            {[
              "Streamline your workflow",
              "Create Quotation, Ticket and Challan",
              "Track each user",
              "Manage your data efficiently",
              "Collaborate seamlessly",
              "Unlock productivity with secure login",
            ].map((feature, index) => (
              <div
                key={index}
                className="feature-card"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Login Section */}
      <div className="login-form-section">
        <div className="login-form-card">
          <h2 className="login-form-title">Login</h2>
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="emailInput">Email address</label>
              <input
                type="email"
                id="emailInput"
                className="form-control"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group password-group">
              <label htmlFor="passwordInput">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                id="passwordInput"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle-btn"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}