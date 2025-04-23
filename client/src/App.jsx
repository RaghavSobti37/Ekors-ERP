import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import Tickets from "./pages/Tickets.jsx";
import Quotations from "./pages/Quotations.jsx";
import Logtime from "./pages/Logtime";
import History from "./pages/History";
import Challan from "./pages/Challan";
import Items from "./pages/Items.jsx";
import PurchaseHistory from './pages/PurchaseHistory.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Unauthorized from './components/Unauthorized.jsx'

function App() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3000');
        const data = await res.json();
        setItems(data.items);
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
          <Route path='/register' element={<Signup />} />
          <Route path='/login' element={<Login />} />

          {/* Protected Routes */}
          <Route path='/tickets' element={
            <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
              <Tickets />
            </ProtectedRoute>
          } />

          <Route path='/quotations' element={
            <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
              <Quotations />
            </ProtectedRoute>
          } />

          <Route path='/logtime' element={
            <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
              <Logtime />
            </ProtectedRoute>
          } />

          <Route path='/history' element={
            <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
              <History />
            </ProtectedRoute>
          } />

          <Route path='/challan' element={
            <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
              <Challan />
            </ProtectedRoute>
          } />

          <Route path='/itemslist' element={
            <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
              <Items />
            </ProtectedRoute>
          } />

          <Route path='/purchasehistory' element={
            <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
              <PurchaseHistory />
            </ProtectedRoute>
          } />
  {/* 
            <Route path='/searchbar' element={<Searchbar />} /> */}
          <Route path='/unauthorized' element={<Unauthorized />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
