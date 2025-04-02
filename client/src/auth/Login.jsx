import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleGuestLogin = () => {
    // Set guest credentials (empty for demo)
    localStorage.setItem('isGuest', 'true');
    navigate('/LandingPage');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      
      localStorage.setItem('token', data.token);
      localStorage.removeItem('isGuest'); // Clear guest flag if regular login
      navigate('/LandingPage');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <AuthForm 
        type="login"
        formData={formData}
        handleChange={handleChange}
        error={error}
        onSubmit={handleSubmit}
      />
      <button 
        onClick={handleGuestLogin}
        className="guest-login-btn"
      >
        Continue as Guest
      </button>
    </div>
  );
}