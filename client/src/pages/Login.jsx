import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner"; // Import LoadingSpinner
import "../css/Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // State for submission loading
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true); // Start loading

    try {
      await auth.login({ email, password });
      navigate("/quotations");
    } catch (err) {
      setError(
        err.data?.error ||
          err.data?.message ||
          err.message ||
          "Invalid credentials"
      );
    } finally {
      setIsSubmitting(false); // Stop loading
    }
  };

  const platformFeatures = [
    "Effortless Quotation Creation",
    "Integrated Client & Item Management",
    "Quotation Status Tracking & PDF Downloads",
    "Quick Quotation Search & Sorting",
    "Seamless Quotation-to-Ticket Conversion",
    "Service Ticket Progress Monitoring",
    "Efficient Time Logging",
    "Easy Access to Work History",
  ];

  return (
    <div className="login-container">
      {/* Left Description Section - Hidden on mobile */}
      <div className="login-description-section">
        <div className="login-description-content">
          <div className="login-header">
            <img src="/logo.png" alt="Logo" className="login-logo" />
            <h1 className="login-title">E-KORS Platform</h1>
          </div>
          {/* Feature Grid */}
          <div className="feature-grid">
            {platformFeatures.map((feature, index) => (
              <div key={index} className="feature-card">
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
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle-btn"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <button type="submit" className="login-submit-btn">
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
