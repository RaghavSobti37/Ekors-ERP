import { toast } from "react-toastify";

/**
 * Retrieves the authentication token from localStorage.
 * @param {object} [userForLogging=null] - Optional user object for enriching logs in case of an error.
 * @returns {string|null} The token or null if not found or an error occurs.
 */
export const getAuthToken = (userForLogging = null) => {
  try {
    const storedValue = localStorage.getItem("erp-user");
    if (!storedValue) {
      return null;
    }

        try {
      // Attempt to parse as JSON - this is the preferred format
      const userData = JSON.parse(storedValue);
      if (userData && typeof userData.token === "string" && userData.token.length > 0) {
        return userData.token; // Return the actual JWT string
      } else {
        // Parsed as JSON, but format is wrong (e.g., no 'token' field or empty token)
        toast.error(
          "Invalid authentication data format in local storage (JSON lacks token string)."
        );
        return null;
      }
    } catch (e) {
      // JSON.parse failed. Check if 'storedValue' itself might be the raw token.
      // Basic check: JWTs are typically three dot-separated base64 strings and often start with "eyJ".
      if (typeof storedValue === 'string' && storedValue.includes('.') && storedValue.startsWith('eyJ')) {
        // Log a warning because this indicates an inconsistency in how 'erp-user' is stored.
        return storedValue; // Return the raw string, assuming it's the token
      } else {
        // Not valid JSON and doesn't look like a raw token.
        // This means the original error (JSON.parse failed on something unexpected) is the issue.
        toast.error(
          "Authentication data in local storage is corrupted or not in a recognizable format."
        );
        return null;
      }

    }
  } catch (e) { // Catch errors from localStorage.getItem() itself, though rare.   
   toast.error(
            "Critical error accessing local storage for authentication token."
    );
    const errorDetails = {
      errorMessage: e.message,
      stack: e.stack,
      context: "getAuthToken - localStorage access or JSON.parse error",
    };

    return null;
  }
};
