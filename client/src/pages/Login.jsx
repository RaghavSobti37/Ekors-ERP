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
    <div className="container-fluid vh-100 p-0">
      <div className="row g-0 h-100">
        {/* Left Description Section - Updated with better styling */}
        <div className="col-md-6 col-lg-7 d-none d-md-flex flex-column justify-content-center align-items-center p-5"
          style={{ 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRight: "3px solid rgba(255, 255, 255, 0.3)",
            position: "relative"
          }}>
          {/* Glow effect on the border */}
          <div style={{
            position: "absolute",
            right: 0,
            top: 0,
            height: "100%",
            width: "3px",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.2))",
            boxShadow: "0 0 10px rgba(255,255,255,0.5)"
          }}></div>
          
          <div className="text-center" style={{ maxWidth: '500px' }}>
            <img 
              src="/logo.png"
              alt="Application Logo" 
              style={{ 
                width: '120px', 
                marginBottom: '30px', 
                filter: 'brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.2))' 
              }} 
            />
            <h1 className="mb-3 display-5 fw-bold" style={{ textShadow: '0 2px 4px #7B1E1E' }}>E-KORS Platform</h1>
            <p className="lead mb-4" style={{ fontSize: '1.1rem', color: 'white' }}>
              Streamline your workflow, manage your data efficiently, and collaborate
              seamlessly with our comprehensive suite of tools. Log in to unlock
              your productivity.
            </p>
            <hr className="my-4" style={{ 
              borderColor: 'rgba(255,255,255,0.3)',
              boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
            }} />
          </div>
        </div>

        {/* Right Login Form Section */}
        <div className="col-md-6 col-lg-5 d-flex justify-content-center align-items-center bg-light">
          <div className="card p-4 p-sm-5 shadow-lg" style={{ 
            width: "100%", 
            maxWidth: "450px",
            border: "none",
            borderRadius: "10px"
          }}>
            <h2 className="text-center mb-4" style={{ color: "#7B1E1E" }}>Login</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-outline mb-3">
                <label htmlFor="emailInput" className="form-label">Email address</label>
                <input
                  type="email"
                  id="emailInput"
                  placeholder="Enter your email"
                  className="form-control form-control-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ borderRadius: "8px" }}
                />
              </div>

              <div className="form-outline mb-4 position-relative">
                <label htmlFor="passwordInput" className="form-label">Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="passwordInput"
                  placeholder="Enter your password"
                  className="form-control form-control-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ borderRadius: "8px" }}
                />
                <button
                  type="button"
                  className="btn position-absolute"
                  style={{ 
                    right: "10px", 
                    top: "70%", 
                    transform: "translateY(-50%)",
                    color: "#7B1E1E"
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash size={20}/> : <FaEye size={20}/>}
                </button>
              </div>

              <button 
                type="submit" 
                className="btn btn-lg w-100"
                style={{
                  backgroundColor: "#7B1E1E",
                  color: "white",
                  borderRadius: "8px",
                  border: "none",
                  padding: "12px",
                  fontWeight: "500",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
                }}
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