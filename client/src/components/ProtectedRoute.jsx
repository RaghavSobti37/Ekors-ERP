import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  const isGuest = localStorage.getItem('isGuest');
  
  return token || isGuest ? children : <Navigate to="/login" replace />;
}