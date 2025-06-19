import React, { useState, useCallback } from 'react'; // Removed useEffect as allItems is unused
import apiClient from '../utils/apiClient'; // Use consistent API client
import { showToast, handleApiError } from '../utils/helpers'; // For notifications and error handling

const PurchaseTracking = () => {
  const initialPurchaseData = {
    companyName: '',
    gstNumber: '',
    address: '',
    state: '',
    invoiceNumber: '',
    date: '',
    items: [{ name: '', description: '', price: '', quantity: '' }],
  };
  const [purchaseData, setPurchaseData] = useState(initialPurchaseData);

  // allItems state and its useEffect are removed as they were unused.
  // If item selection from a list is needed, ItemSearchComponent should be integrated.

  const handlePurchaseChange = useCallback((e) => {
    setPurchaseData({ ...purchaseData, [e.target.name]: e.target.value });
  }, [purchaseData]);

  const handleItemChange = useCallback((index, field, value) => {
    const updatedItems = [...purchaseData.items];
    updatedItems[index][field] = value;
    setPurchaseData({ ...purchaseData, items: updatedItems });
  }, [purchaseData]);

  const addNewItemRow = useCallback(() => {
    setPurchaseData({
      ...purchaseData,
      items: [...purchaseData.items, { name: '', description: '', price: '', quantity: '' }],
    });
  }, [purchaseData]);

  const handleSubmit = useCallback(async () => {
    try {
      await apiClient('/purchases', { method: 'POST', body: purchaseData }); // Use apiClient
      showToast('Purchase added successfully!', true);
      setPurchaseData(initialPurchaseData); // Reset form
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to add purchase");
      showToast(errorMessage, false);
      // setError(errorMessage); // If you have a local error state for the form
    }
  }, [purchaseData, initialPurchaseData]);

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
};

export default React.memo(PurchaseTracking);
