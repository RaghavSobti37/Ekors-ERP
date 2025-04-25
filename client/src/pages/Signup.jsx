import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../css/Signup.css';
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function Signup() {
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== repeatPassword) {
      setError("Passwords don't match!");
      return;
    }

    try {
      await axios.post('http://localhost:3000/register', {
        firstname,
        lastname,
        email,
        phone,
        password,
      });

      console.log('Form submitted:', { firstname, lastname, email, phone, password });
      navigate('/login');
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="card p-4 shadow-lg signup-card">
        <h2 className="text-center mb-4">Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            {/* Column 1 */}
            <div className="col-md-4">
              <div className="form-outline mb-3">
                <label className="form-label">
                  First Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="First Name"
                  className="form-control"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  required
                />
              </div>

              <div className="form-outline mb-3">
                <label className="form-label">
                  Last Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Last Name"
                  className="form-control"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Column 2 */}
            <div className="col-md-4">
              <div className="form-outline mb-3">
                <label className="form-label">
                  Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-outline mb-3">
                <label className="form-label">
                  Mobile Number <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Mobile Number"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Column 3 */}
            <div className="col-md-4">
              <div className="form-outline mb-3">
                <label className="form-label">
                  Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-outline mb-3">
                <label className="form-label">
                  Repeat Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Repeat Password"
                  className="form-control"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {error && <p className="text-danger text-center">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block w-100 mt-2">Sign Up</button>
        </form>
        <p className="text-center mt-3">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
}
