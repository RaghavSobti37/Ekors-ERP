import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGuestLogin = () => {
    localStorage.setItem('isGuest', 'true');
    navigate('/landing');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      
      localStorage.setItem('token', data.token);
      localStorage.removeItem('isGuest');
      navigate('/landing');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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
        isLoading={isLoading}
      />
      <button 
        onClick={handleGuestLogin}
        className="guest-login-btn"
        disabled={isLoading}
      >
        Continue as Guest
      </button>
    </div>
  );
}