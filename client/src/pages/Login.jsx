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
    <div className="container-fluid vh-100 p-0">
      <div className="row g-0 h-100">
        {/* Left Description Section */}
        <div
          className="col-md-6 col-lg-7 d-none d-md-flex flex-column justify-content-center align-items-center p-5"
          style={{
            background: "var(--primary-color)",
            color: "var(--light-color)",
          }}
        >
          <div className="text-center w-100" style={{ maxWidth: "600px" }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{
                width: "100px",
                marginBottom: "2rem",
                filter: "brightness(0) invert(1)",
              }}
            />
            <h1 className="mb-4 fw-bold">E-KORS Platform</h1>

            {/* 2x3 Grid */}
            <div
              className="feature-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1rem",
              }}
            >
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
                  style={{
                    background: "var(--card-bg)",
                    borderRadius: "var(--border-radius-md)",
                    padding: "1rem",
                    border: `1px solid var(--card-border)`,
                    boxShadow: "var(--card-shadow)",
                    transition: "var(--transition-normal)",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "var(--card-hover-bg)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "var(--card-bg)")
                  }
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Login Section */}
        <div className="col-md-6 col-lg-5 d-flex align-items-center justify-content-center bg-white">
          <div
            className="card p-4 p-md-5 shadow"
            style={{
              width: "100%",
              maxWidth: "450px",
              borderRadius: "var(--border-radius-lg)",
              border: "none",
            }}
          >
            <h2
              className="mb-4 text-center"
              style={{ color: "var(--primary-color)" }}
            >
              Login
            </h2>
            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label htmlFor="emailInput">Email address</label>
                <input
                  type="email"
                  id="emailInput"
                  className="form-control"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ borderRadius: "var(--border-radius-md)" }}
                />
              </div>

              <div className="form-group mb-4 position-relative">
                <label htmlFor="passwordInput">Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="passwordInput"
                  className="form-control"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ borderRadius: "var(--border-radius-md)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn position-absolute"
                  style={{
                    top: "60%",
                    right: "10px",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--secondary-color)",
                  }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <button
                type="submit"
                className="btn w-100"
                style={{
                  backgroundColor: "var(--primary-color)",
                  color: "#fff",
                  padding: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "var(--border-radius-md)",
                  transition: "var(--transition-normal)",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--primary-hover)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--primary-color)")
                }
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
