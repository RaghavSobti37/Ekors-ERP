import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function PurchaseTracking() {
  const [purchaseData, setPurchaseData] = useState({
    companyName: '',
    gstNumber: '',
    address: '',
    state: '',
    invoiceNumber: '',
    date: '',
    items: [{ name: '', description: '', price: '', quantity: '' }],
  });

  const [allItems, setAllItems] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:3000/api/items').then((res) => {
      setAllItems(res.data);
    });
  }, []);

  const handlePurchaseChange = (e) => {
    setPurchaseData({ ...purchaseData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...purchaseData.items];
    updatedItems[index][field] = value;
    setPurchaseData({ ...purchaseData, items: updatedItems });
  };

  const addNewItemRow = () => {
    setPurchaseData({
      ...purchaseData,
      items: [...purchaseData.items, { name: '', description: '', price: '', quantity: '' }],
    });
  };

  const handleSubmit = async () => {
    try {
      await axios.post('http://localhost:3000/api/purchases', purchaseData);
      alert('Purchase added successfully!');
      setPurchaseData({
        companyName: '',
        gstNumber: '',
        address: '',
        state: '',
        invoiceNumber: '',
        date: '',
        items: [{ name: '', description: '', price: '', quantity: '' }],
      });
    } catch (err) {
      console.error(err);
      alert('Failed to add purchase');
    }
  };

  return (
    <div className="container mt-4">
      <h2>Purchase Tracking</h2>
      <div className="form-group">
        <input name="companyName" className="form-control my-2" placeholder="Company Name" value={purchaseData.companyName} onChange={handlePurchaseChange} />
        <input name="gstNumber" className="form-control my-2" placeholder="GST Number" value={purchaseData.gstNumber} onChange={handlePurchaseChange} />
        <input name="address" className="form-control my-2" placeholder="Address" value={purchaseData.address} onChange={handlePurchaseChange} />
        <input name="state" className="form-control my-2" placeholder="State Name" value={purchaseData.state} onChange={handlePurchaseChange} />
        <input name="invoiceNumber" className="form-control my-2" placeholder="Invoice Number" value={purchaseData.invoiceNumber} onChange={handlePurchaseChange} />
        <input type="date" name="date" className="form-control my-2" value={purchaseData.date} onChange={handlePurchaseChange} />
      </div>

      <h4 className="mt-4">Items Purchased</h4>
      {purchaseData.items.map((item, index) => (
        <div key={index} className="row my-2">
          <div className="col">
            <input className="form-control" placeholder="Item Name" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} />
          </div>
          <div className="col">
            <input className="form-control" placeholder="Description" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} />
          </div>
          <div className="col">
            <input className="form-control" type="number" placeholder="Price" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} />
          </div>
          <div className="col">
            <input className="form-control" type="number" placeholder="Quantity" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
          </div>
        </div>
      ))}
      <button className="btn btn-outline-primary my-2" onClick={addNewItemRow}>Add Item</button>
      <br />
      <button className="btn btn-success" onClick={handleSubmit}>Submit Purchase</button>
    </div>
  );
}