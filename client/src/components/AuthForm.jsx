import { Link } from 'react-router-dom';

export default function AuthForm({ 
  type = 'login',
  formData = {},
  handleChange = () => {},
  error = '',
  onSubmit = () => {}
}) {
  return (
    <div className="auth-container">
      <h2>{type === 'login' ? 'Login' : 'Sign Up'}</h2>
      
      {error && <div className="error">{error}</div>}

      <form onSubmit={onSubmit}>
        {type === 'signup' && (
          <>
            <input
              type="text"
              name="firstName"
              value={formData.firstName || ''}
              onChange={handleChange}
              placeholder="First Name"
              required
              autoComplete="given-name"
            />
            <input
              type="text"
              name="lastName"
              value={formData.lastName || ''}
              onChange={handleChange}
              placeholder="Last Name"
              required
              autoComplete="family-name"
            />
          </>
        )}

        <input
          type="email"
          name="email"
          value={formData.email || ''}
          onChange={handleChange}
          placeholder="Email"
          required
          autoComplete="email"
        />

        {type === 'signup' && (
          <input
            type="tel"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
            placeholder="Phone Number"
            required
            autoComplete="tel"
          />
        )}

        <input
          type="password"
          name="password"
          value={formData.password || ''}
          onChange={handleChange}
          placeholder={type === 'login' ? 'Password' : 'Set Password'}
          required
          minLength="6"
          autoComplete={type === 'login' ? 'current-password' : 'new-password'}
        />

        {type === 'signup' && (
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword || ''}
            onChange={handleChange}
            placeholder="Confirm Password"
            required
            minLength="6"
            autoComplete="new-password"
          />
        )}

        <button type="submit">
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