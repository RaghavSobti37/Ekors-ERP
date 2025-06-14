import { toast } from "react-toastify";
import frontendLogger from "./frontendLogger"; // Assuming frontendLogger.js is in the same utils directory

/**
 * Retrieves the authentication token from localStorage.
 * @param {object} [userForLogging=null] - Optional user object for enriching logs in case of an error.
 * @returns {string|null} The token or null if not found or an error occurs.
 */
export const getAuthToken = (userForLogging = null) => {
  try {
    const storedValue = localStorage.getItem("erp-user");
    if (!storedValue) {

      // frontendLogger.debug("getAuthToken", "Authentication data not found in local storage.", userForLogging);
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
        frontendLogger.error(
          "authDataFormat",
          "Invalid auth data format in localStorage: JSON parsed, but 'token' property missing, not a string, or empty.",
          userForLogging,
          { storedDataPreview: storedValue.substring(0, 100) }
        );
        return null;
      }
    } catch (e) {
      // JSON.parse failed. Check if 'storedValue' itself might be the raw token.
      // Basic check: JWTs are typically three dot-separated base64 strings and often start with "eyJ".
      if (typeof storedValue === 'string' && storedValue.includes('.') && storedValue.startsWith('eyJ')) {
        // Log a warning because this indicates an inconsistency in how 'erp-user' is stored.
        frontendLogger.warn(
          "authDataFormat",
          "Raw token string found in 'erp-user' localStorage instead of JSON object. Using raw token.",
          userForLogging,
          { storedDataPreview: storedValue.substring(0, 30) } // Log only a preview
        );
        return storedValue; // Return the raw string, assuming it's the token
      } else {
        // Not valid JSON and doesn't look like a raw token.
        // This means the original error (JSON.parse failed on something unexpected) is the issue.
        toast.error(
          "Authentication data in local storage is corrupted or not in a recognizable format."
        );
        frontendLogger.error(
          "authDataParseError",
          "Failed to parse 'erp-user' from localStorage as JSON, and it does not appear to be a raw token.",
          userForLogging,
          { errorMessage: e.message, storedDataPreview: storedValue.substring(0, 100) }
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
    frontendLogger.error(
     "localStorageAccessCritical",
      "Critical failure accessing localStorage for 'erp-user'",
      userForLogging,
      errorDetails
    );

    return null;
  }
};
