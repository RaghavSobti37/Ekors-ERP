import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Signup from './Signup.jsx'
import Login from './Login.jsx';
import Dashboard from "./Tickets.jsx";
import Quotations from "./Quotations";
import Logtime from "./Logtime";
import { BrowserRouter , Routes , Route } from 'react-router-dom';

function App() {
  const [items , setItems] =useState([])
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3000');
        const data = await res.json();
        setItems(data.items)
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);


  return <>
  <BrowserRouter>
  <Routes>
    <Route path='/register' element={<Signup />}> </Route>
    <Route path='/login' element={<Login />}> </Route>
    <Route path='/tickets' element={<Dashboard />}></Route>
    <Route path='/quotations' element={<Quotations />}></Route>
    <Route path='/logtime' element={<Logtime />}></Route>
   
    </Routes>
  </BrowserRouter>
  </>
}

export default App;
