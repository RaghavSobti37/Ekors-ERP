import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

export default function AuthForm({ 
  type = 'login',
  formData = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    confirmPassword: ''
  },
  handleChange = () => {},
  error = '',
  onSubmit = () => {},
  isLoading = false
}) {
  return (
    <div className="auth-container">
      <h2>{type === 'login' ? 'Login' : 'Sign Up'}</h2>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={onSubmit}>
        {type === 'signup' && (
          <>
            <div className="form-group">
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First Name"
                required
                autoComplete="given-name"
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last Name"
                required
                autoComplete="family-name"
              />
            </div>
          </>
        )}

        <div className="form-group">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Email"
            required
            autoComplete="email"
          />
        </div>

        {type === 'signup' && (
          <div className="form-group">
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone Number"
              required
              autoComplete="tel"
            />
          </div>
        )}

        <div className="form-group">
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={type === 'login' ? 'Password' : 'Set Password'}
            required
            minLength="6"
            autoComplete={type === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {type === 'signup' && (
          <div className="form-group">
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm Password"
              required
              minLength="6"
              autoComplete="new-password"
            />
          </div>
        )}

        <button 
          type="submit" 
          className={`submit-btn ${isLoading ? 'loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner"></span>
              Processing...
            </>
          ) : (
            type === 'login' ? 'Login' : 'Sign Up'
          )}
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

AuthForm.propTypes = {
  type: PropTypes.oneOf(['login', 'signup']),
  formData: PropTypes.shape({
    email: PropTypes.string,
    password: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    phone: PropTypes.string,
    confirmPassword: PropTypes.string
  }),
  handleChange: PropTypes.func,
  error: PropTypes.string,
  onSubmit: PropTypes.func,
  isLoading: PropTypes.bool
};