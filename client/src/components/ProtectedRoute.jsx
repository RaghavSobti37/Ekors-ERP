import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner.jsx"; // For a better user experience

function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  // 1. While the authentication state is being determined, show a loading spinner.
  //    This prevents the premature redirect and is the key to fixing the race condition.
  if (authLoading) {
    return <LoadingSpinner show={true} />;
  }

  // 2. After loading, if there's no user, redirect to the login page.
  //    We pass the current location so the user can be redirected back after logging in.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. If the user is logged in but doesn't have the required role, redirect.
  //    It's better to send them to a dedicated "unauthorized" page or the home page.
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />; // Consider creating an /unauthorized page
  }

  return children;
}

export default React.memo(ProtectedRoute);
