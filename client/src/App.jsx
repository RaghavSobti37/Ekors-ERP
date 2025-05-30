import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import QuotationPDF from "./components/QuotationPDF";
import PIPDF from "./components/PIPDF";
import Login from "./pages/Login.jsx";
import Tickets from "./pages/Tickets.jsx";
import Quotations from "./pages/Quotations.jsx";
import History from "./pages/History";
import Users from "./pages/Users";
import Challan from "./pages/Challan";
import Items from "./pages/Items.jsx";
import Pagination from "./components/Pagination.jsx";
// import AddNewItem from "./pages/AddNewItem.jsx";
import PurchaseHistory from "./pages/PurchaseHistory.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Unauthorized from "./components/Unauthorized.jsx";
import frontendLogger from './utils/frontendLogger.js';

function App() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Point to your actual API endpoint for items
        // Assuming your items are fetched from '/api/items'
        // and your server is running on localhost:3000
        // Also, ensure your API returns data in the format { items: [...] }
        // or adjust how you access `data.items` below.
        const res = await fetch("http://localhost:3000/api/items"); 
        const data = await res.json();
        // If your API directly returns an array of items, use: setItems(data);
        // If it returns an object like { items: [...] }, use: setItems(data.items);
        setItems(data); // Adjust based on your API response structure
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

   useEffect(() => {
    const originalOnError = window.onerror;
    window.onerror = (msg, url, lineNo, columnNo, error) => {
      frontendLogger.error(
        'global-error', // type
        String(msg),    // message
        null,           // user (global errors are not typically user-specific at this point)
        {               // details
          url,
          lineNo,
          columnNo,
          errorMessage: error ? String(error.message) : String(msg), // more specific error message
          stack: error ? error.stack : undefined
        }
      );
      if (originalOnError) {
        // Call previous handler if it exists
        return originalOnError(msg, url, lineNo, columnNo, error);
      }
      // Return true to prevent default browser error handling for caught errors
      // return true; // Or false depending on desired behavior
    };

    // Optional: Capture unhandled promise rejections
    const originalOnUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      const reason = event.reason;
      let messageText = 'Unhandled promise rejection';
      let stackTrace;

      if (reason instanceof Error) {
        messageText = reason.message;
        stackTrace = reason.stack;
      } else if (typeof reason === 'string') {
        messageText = reason;
      } else {
        try {
          messageText = `Unhandled promise rejection: ${JSON.stringify(reason)}`;
        } catch (e) {
          messageText = 'Unhandled promise rejection with non-serializable reason.';
        }
      }
      
      frontendLogger.error('unhandled-rejection', messageText, null, {
        errorMessage: (reason instanceof Error) ? reason.message : messageText,
        stack: stackTrace,
        rejectionDetails: typeof reason === 'object' ? { ...reason } : String(reason) // Avoid circular refs
      });
      if (originalOnUnhandledRejection) {
        return originalOnUnhandledRejection.call(window, event);
      }
    };

    return () => {
      window.onerror = originalOnError;
      window.onunhandledrejection = originalOnUnhandledRejection;
    };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/quotationpdf" element={<QuotationPDF />} />
          <Route path="/pipdf" element={<PIPDF />} />
          <Route path="/pagination" element={<Pagination />} />
          <Route path="/users" element={<Users />} />
          {/* <Route path="/addnewitem" element={<AddNewItem />} /> */}
          {/* <Route path="/logtime" element={<Logtime />} /> */}

          {/* Protected Routes */}
          <Route
            path="/tickets"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <Tickets />
              </ProtectedRoute>
            }
          />

          <Route
            path="/quotations"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <Quotations />
              </ProtectedRoute>
            }
          />

          <Route
            path="/logtime"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <History />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <History />
              </ProtectedRoute>
            }
          />

          <Route
            path="/challan"
            element={
              <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
                <Challan />
              </ProtectedRoute>
            }
          />

          <Route
            path="/itemslist"
            element={
              <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
                <Items />
              </ProtectedRoute>
            }
          />

          <Route
            path="/purchasehistory"
            element={
              <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
                <PurchaseHistory />
              </ProtectedRoute>
            }
          />
          {/* <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={["super-admin"]}>
                <AnalystPage />
              </ProtectedRoute>
            }
          /> */}
          {/* <Route
            path="/history/:userId"
            element={
              <ProtectedRoute allowedRoles={["super-admin", "admin"]}>
                <UserHistoryPage />
              </ProtectedRoute>
            }
          /> */}
          {/* 
            <Route path='/searchbar' element={<Searchbar />} /> */}
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
