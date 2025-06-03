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
        {/* Left Description Section */}
        <div className="col-md-6 col-lg-7 d-none d-md-flex flex-column justify-content-center align-items-center bg-primary text-white p-5">
          <div className="text-center" style={{ maxWidth: '500px' }}>
            <img 
              src="/logo.png" // Assuming your logo is in the public folder
              alt="Application Logo" 
              style={{ width: '120px', marginBottom: '30px', filter: 'brightness(0) invert(1)' }} 
            />
            <h1 className="mb-3 display-5 fw-bold">Welcome to Our Platform</h1>
            <p className="lead mb-4">
              Streamline your workflow, manage your data efficiently, and collaborate
              seamlessly with our comprehensive suite of tools. Log in to unlock
              your productivity.
            </p>
            <hr className="my-4" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
            <p className="mb-0">
              Need help? Visit our <a href="/support" className="text-white fw-bold text-decoration-none">Support Center</a> or <a href="/contact" className="text-white fw-bold text-decoration-none">Contact Us</a>.
            </p>
          </div>
        </div>

        {/* Right Login Form Section */}
        <div className="col-md-6 col-lg-5 d-flex justify-content-center align-items-center bg-light">
          <div className="card p-4 p-sm-5 shadow-lg" style={{ width: "100%", maxWidth: "450px" }}>
            <h2 className="text-center mb-4">Login</h2>
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
                />
                <button
                  type="button"
                  className="btn position-absolute"
                  style={{ right: "10px", top: "60%", transform: "translateY(-50%)" }} // Adjusted top for label
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash size={20}/> : <FaEye size={20}/>}
                </button>
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-100">
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}