import { Link } from 'react-router-dom';

export default function AuthForm({ 
  type, 
  formData = {},  // Ensure default value to avoid undefined errors
  handleChange, 
  error, 
  onSubmit 
}) {
  return (
    <div className="auth-container">
      <h2>{type === 'login' ? 'Login' : 'Sign Up'}</h2>
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={onSubmit}>
        {type === 'signup' && (
          <>
            <div className="form-group">
              <input
                type="text"
                name="firstName"
                value={formData?.firstName || ""}
                onChange={handleChange}
                placeholder="First Name"
                required
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                name="lastName"
                value={formData?.lastName || ""}
                onChange={handleChange}
                placeholder="Last Name"
                required
              />
            </div>
            <div className="form-group">
              <input
                type="tel"
                name="phone"
                value={formData?.phone || ""}
                onChange={handleChange}
                placeholder="Phone Number"
                required
              />
            </div>
          </>
        )}
        
        <div className="form-group">
          <input
            type="email"
            name="email"
            value={formData?.email || ""}
            onChange={handleChange}
            placeholder="Email"
            required
          />
        </div>
        
        <div className="form-group">
          <input
            type="password"
            name="password"
            value={formData?.password || ""}
            onChange={handleChange}
            placeholder={type === 'login' ? 'Password' : 'Set Password'}
            required
          />
        </div>
        
        {type === 'signup' && (
          <div className="form-group">
            <input
              type="password"
              name="confirmPassword"
              value={formData?.confirmPassword || ""}
              onChange={handleChange}
              placeholder="Confirm Password"
              required
            />
          </div>
        )}
        
        <button type="submit" className="submit-btn">
          {type === 'login' ? 'Login' : 'Sign Up'}
        </button>
      </form>
      
      <div className="auth-footer">
        {type === 'login' ? (
          <p>Don't have an account? <Link to="/signup">Sign Up</Link></p>
        ) : (
          <p>Already have an account? <Link to="/login">Login</Link></p>
        )}
      </div>
    </div>
  );
}
