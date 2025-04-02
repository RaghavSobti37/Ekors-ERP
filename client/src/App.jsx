import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [items , setItems] =useState([])
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3000'); // ✅ Correct backend port
        const data = await res.json();
        setItems(data.items)
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  return <>
  {items.map(i => (
    <p>{i.firstname}  {i.lastname}</p>
  ))}
  {items.map(i => (
    <p>{i.email}</p>
  ))}
  {items.map(i => (
    <p>{i.phone}</p>
  ))}
  </>
}

export default App;
