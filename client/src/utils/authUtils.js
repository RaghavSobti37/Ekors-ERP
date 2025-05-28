import { toast } from 'react-toastify';
import frontendLogger from './frontendLogger'; // Assuming frontendLogger.js is in the same utils directory

/**
 * Retrieves the authentication token from localStorage.
 * @param {object} [userForLogging=null] - Optional user object for enriching logs in case of an error.
 * @returns {string|null} The token or null if not found or an error occurs.
 */
export const getAuthToken = (userForLogging = null) => {
  try {
    const token = localStorage.getItem("erp-user");
    // It's generally better to let the calling function decide if a missing token is a warning/error
    // if (!token) {
    //   toast.warn("Authentication token not found.");
    // }
    return token || null;
  } catch (e) {
    toast.error("Error accessing local storage for authentication token.");
    const errorDetails = {
      errorMessage: e.message,
      stack: e.stack,
      context: "getAuthToken - localStorage access"
    };
    frontendLogger.error("localStorageAccess", "Failed to get auth token from localStorage", userForLogging, errorDetails);
    return null;
  }
};