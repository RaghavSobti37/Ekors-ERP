// src/utils/helpers.js
import { toast } from 'react-toastify';
import frontendLogger from './frontendLogger'; // Assuming frontendLogger.js is in the same utils directory

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
 * @param {string} [logType='apiError'] - Type of log for frontendLogger.
 * @returns {string} A user-friendly error message.
 */
export const handleApiError = (error, defaultMessage = 'An unexpected error occurred.', userForLogging = null, logType = 'apiError') => {
  let errorMessage = defaultMessage;

  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (error.response.data) {
      if (typeof error.response.data === 'string' && error.response.data.length < 250) { // Avoid overly long strings
        errorMessage = error.response.data;
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      // You can add more specific checks here if your backend has consistent error structures
      // e.g., if (error.response.data.errors && Array.isArray(error.response.data.errors)) { ... }
    } else if (error.response.statusText) {
      errorMessage = `Error ${error.response.status}: ${error.response.statusText}`;
    }
  } else if (error.request) {
    // The request was made but no response was received
    errorMessage = 'No response from server. Please check your network connection.';
  } else if (error.message) {
    // Something happened in setting up the request that triggered an Error
    errorMessage = error.message;
  }

  // Log the error
  frontendLogger.error(
    logType,
    `API Error: ${errorMessage}`,
    userForLogging,
    {
      originalErrorMessage: error.message,
      status: error.response?.status,
      responseData: error.response?.data,
      requestConfig: error.config, // If using Axios, this contains request details
      stack: error.stack,
    }
  );

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
    // Log error if needed, e.g., frontendLogger.error('dateFormatting', 'Error in formatDateTime', null, { dateString, error });
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


