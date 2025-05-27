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
              <ProtectedRoute allowedRoles={["user",  "admin", "super-admin"]}>
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
