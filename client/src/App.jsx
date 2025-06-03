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

<ToastContainer
  position="top-right"
  autoClose={5000}
  hideProgressBar={false}
  newestOnTop={false}
  closeOnClick
  rtl={false}
  pauseOnFocusLoss
  draggable
  pauseOnHover
  theme="colored"
/>;

function App() {
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
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
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
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
