import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa"; // ✅ Import eye icons
import { useAuth } from "./context/AuthContext"; // Adjust path if needed

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false); // ✅ State for toggling password visibility
  const navigate = useNavigate(); 
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Sending login request:", { email, password });

    try {
      const response = await axios.post("http://localhost:3000/login", {
        email,
        password,
      });
  
      const { token, user } = response.data;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  
      login({ ...user, token });
  
      if (user.role === "super-admin") navigate("/quotations");
      else if (user.role === "admin") navigate("/logtime");
      else navigate("/tickets");
    } catch (err) {
      console.error("Login failed:", err);
      setError("Invalid email or password");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="card p-4 shadow-lg" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Login</h2>
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

          {/* Password Input with Toggle Eye Icon */}
          <div className="form-outline mb-3 position-relative">
            <input
              type={showPassword ? "text" : "password"} // ✅ Toggle between text & password
              placeholder="Password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {/* Eye Toggle Button */}
            <button
              type="button"
              className="btn position-absolute"
              style={{ right: "10px", top: "50%", transform: "translateY(-50%)" }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />} {/* Toggle Icons */}
            </button>
          </div>

          {error && <p className="text-danger text-center">{error}</p>}

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
