import { toast } from 'react-toastify';

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {boolean} [isSuccess=true] - Whether the toast indicates success or error.
 * @param {object} [options={}] - Additional options for react-toastify.
 */
export const showToast = (message, isSuccess = true, options = {}) => {
  const toastOptions = {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    ...options,
  };

  if (isSuccess) {
    toast.success(message, toastOptions);
  } else {
    toast.error(message, toastOptions);
  }
};

/**
 * Handles API errors, logs them, and returns a user-friendly message.
 * @param {Error} error - The error object from an API call (e.g., from Axios or Fetch).
 * @param {string} [defaultMessage='An unexpected error occurred.'] - Default message if a specific one cannot be extracted.
 * @param {object} [userForLogging=null] - Optional user object for enriching logs.
 * @returns {string} A user-friendly error message.
 */
export const handleApiError = (error, defaultMessage = 'An unexpected error occurred.', userForLogging = null, logType = 'apiError') => {
  let errorMessage = defaultMessage;

  // Ensure error is an object to prevent "Cannot read properties of null" errors
  const safeError = error || {};

  if (safeError.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (safeError.response.data) {
      if (typeof safeError.response.data === 'string' && safeError.response.data.length < 250) { // Avoid overly long strings
        errorMessage = safeError.response.data;
      } else if (safeError.response.data.message) {
        errorMessage = safeError.response.data.message;
      } else if (safeError.response.data.error) {
        errorMessage = safeError.response.data.error;
      }
    } else if (safeError.response.statusText) {
      errorMessage = `Error ${safeError.response.status}: ${safeError.response.statusText}`;
    }
  } else if (safeError.request) {
    // The request was made but no response was received
    errorMessage = 'No response from server. Please check your network connection.';
  } else if (safeError.message) {
    // Something happened in setting up the request that triggered an Error
    errorMessage = safeError.message;
  }

  // Display the error message to the user in a toast
  showToast(errorMessage, false);

  return errorMessage;
};

/**
 * Formats a date string for display (e.g., DD-Month-YYYY).
 * @param {string | Date} dateString - The date string or Date object to format.
 * @returns {string} The formatted date string or the original string if invalid.
 */
export const formatDisplayDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Return original if invalid

  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};


/**
 * Formats a date string for input fields (e.g., YYYY-MM-DD).
 * @param {string | Date} dateString - The date string or Date object to format.
 * @returns {string} The formatted date string (YYYY-MM-DD) or an empty string if invalid.
 */
export const formatDateForInput = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return ""; // Return empty if invalid

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


/**
 * Generates a unique ID string.
 * Useful for temporary client-side IDs.
 * @returns {string} A unique string.
 */
export const generateUniqueId = () => {
  return Math.random().toString(36).substr(2, 9);
};


/**
 * Delays execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A simple debounce function.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Formats a date string or Date object into a more readable date and time string.
 * e.g., "DD/MM/YYYY, HH:MM AM/PM"
 * @param {string | Date} dateString - The date string or Date object to format.
 * @returns {string} The formatted date-time string or 'N/A' if invalid.
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleString('en-GB', { // en-GB for DD/MM/YYYY format, adjust as needed
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch (error) {
    return 'Invalid Date';
  }
};


/**
 * Converts a Date object to a "YYYY-MM-DD" string.
 * @param {Date} date - The Date object to format.
 * @returns {string} The date formatted as "YYYY-MM-DD".
 */
export const dateToYYYYMMDD = (date) => {
  if (!(date instanceof Date) || isNaN(date)) {
    // Fallback or error for unexpected input
    console.warn("dateToYYYYMMDD expects a valid Date object. Falling back to today's date.");
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed.
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Generates the next quotation number based on the current timestamp.
 * @returns {string} The generated quotation number.
 */
export const generateNextQuotationNumber = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
};

/**
 * Generates the next ticket number based on the current timestamp.
 * @returns {string} The generated ticket number.
 */
export const generateNextTicketNumber = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `EKORS/${year}${month}${day}-${hours}${minutes}${seconds}`;
};

/**
 * Returns the style object for read-only form fields with enhanced visibility.
 * @param {boolean} [isReadOnly=true] - Whether the field is read-only.
 * @param {object} [additionalStyles={}] - Additional styles to merge.
 * @returns {object} - Style object for the form field.
 */
export const getReadOnlyFieldStyle = (isReadOnly = true, additionalStyles = {}) => {
  return isReadOnly
    ? {
        backgroundColor: "#f0f2f5", // Slightly darker than default for better visibility
        borderColor: "#dee2e6",
        opacity: 1,
        cursor: "not-allowed",
        color: "#495057",
        ...additionalStyles
      }
    : additionalStyles;
};

