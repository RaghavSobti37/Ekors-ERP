import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../css/Signup.css';
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function Signup() {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    password: '',
    repeatPassword: ''
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("[DEBUG] Signup form submitted:", formData);
    
    if (formData.password !== formData.repeatPassword) {
      setError("Passwords don't match!");
      return;
    }

    try {
      console.log("[DEBUG] Sending registration request to server...");
      const response = await axios.post('http://localhost:3000/register', {
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      console.log("[DEBUG] Registration successful, response:", response.data);
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (error) {
      console.error("[ERROR] Registration failed:", error.response?.data || error.message);
      setError(error.response?.data?.error || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="card p-4 shadow-lg signup-card">
        <h2 className="text-center mb-4">Sign Up</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-md-6">
              <div className="form-group mb-3">
                <label>First Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="firstname"
                  className="form-control"
                  value={formData.firstname}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group mb-3">
                <label>Last Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="lastname"
                  className="form-control"
                  value={formData.lastname}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group mb-3">
                <label>Email <span className="text-danger">*</span></label>
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group mb-3">
                <label>Phone</label>
                <input
                  type="text"
                  name="phone"
                  className="form-control"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group mb-3 position-relative">
                <label>Password <span className="text-danger">*</span></label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-control"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="btn position-absolute"
                  style={{ right: "10px", top: "70%" }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group mb-3">
                <label>Repeat Password <span className="text-danger">*</span></label>
                <input
                  type="password"
                  name="repeatPassword"
                  className="form-control"
                  value={formData.repeatPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block w-100 mt-2">
            Sign Up
          </button>
        </form>
        <p className="text-center mt-3">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
}