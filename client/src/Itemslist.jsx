import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './css/Items.css';
import Navbar from "./components/Navbar.jsx";

export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', quantity: '', price: '', gstRate: '', hsnCode: '' });
  const [showModal, setShowModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [purchaseData, setPurchaseData] = useState({
    companyName: '',
    gstNumber: '',
    address: '',
    stateName: '',
    invoiceNumber: '',
    invoiceDate: '',
    itemsPurchased: [{ name: '', description: '', price: '', quantity: '' }],
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3000/api/items');
      setItems(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item._id);
    setFormData(item);
  };

  const handleSave = async () => {
    try {
      await axios.put(`http://localhost:3000/api/items/${editingItem}`, formData);
      await fetchItems();
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleCancel = () => setEditingItem(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedItems = React.useMemo(() => {
    let sortableItems = [...items];
    sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [items, sortConfig]);

  const filteredItems = sortedItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const handleAddItem = async () => {
    try {
      await axios.post('http://localhost:3000/api/items', formData);
      await fetchItems();
      setShowModal(false);
      setFormData({ name: '', quantity: '', price: '', gstRate: '', hsnCode: '' });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handlePurchaseChange = (e) => {
    setPurchaseData({ ...purchaseData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...purchaseData.itemsPurchased];
    updatedItems[index][field] = value;
    setPurchaseData({ ...purchaseData, itemsPurchased: updatedItems });
  };

  const addPurchaseItemRow = () => {
    setPurchaseData({
      ...purchaseData,
      itemsPurchased: [...purchaseData.itemsPurchased, { name: '', description: '', price: '', quantity: '' }]
    });
  };

  const toggleDetails = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <h2 style={{ color: 'black' }}>Items List</h2>

        <div className="mb-3 d-flex gap-2">
          <button onClick={() => setShowModal(true)} className="btn btn-success px-4">Add Item</button>
          <button onClick={() => setShowPurchaseModal(true)} className="btn btn-primary px-4">Add Purchase</button>
          <input
            type="text"
            placeholder="Search items or HSN codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
              <tr>
                {['name', 'quantity', 'price', 'gstRate', 'hsnCode'].map((key) => (
                  <th key={key} onClick={() => requestSort(key)} style={{ cursor: 'pointer' }}>
                    {key.charAt(0).toUpperCase() + key.slice(1)} {sortConfig.key === key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
                <th>Actions</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item) => (
                <React.Fragment key={item._id}>
                  <tr>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{parseFloat(item.price).toFixed(2)}</td>
                    <td>{item.gstRate}%</td>
                    <td>{item.hsnCode}</td>
                    <td>
                      <button onClick={() => handleEdit(item)} className="btn btn-primary btn-sm">Edit</button>
                    </td>
                    <td>
                      <button onClick={() => toggleDetails(item._id)} className="btn btn-info btn-sm">Details</button>
                    </td>
                  </tr>
                  {expandedRow === item._id && (
                    <tr>
                      <td colSpan="7">
                        <strong>Company:</strong> {purchaseData.companyName || 'Demo Company'}<br />
                        <strong>GST:</strong> {purchaseData.gstNumber}<br />
                        <strong>Address:</strong> {purchaseData.address}<br />
                        <strong>State:</strong> {purchaseData.stateName}<br />
                        <strong>Invoice No:</strong> {purchaseData.invoiceNumber}<br />
                        <strong>Date:</strong> {purchaseData.invoiceDate}<br />
                        <strong>Items Purchased:</strong>
                        <ul>
                          {purchaseData.itemsPurchased.map((it, idx) => (
                            <li key={idx}>
                              {it.name} - {it.description} - ₹{it.price} x {it.quantity}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <div className="d-flex justify-content-center gap-3 mt-2">
            <button className="btn btn-sm btn-outline-dark" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
              ← Prev
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button className="btn btn-sm btn-outline-dark" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
              Next →
            </button>
          </div>
        </div>

        {showModal && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h5>Add New Item</h5>
              {['name', 'quantity', 'price', 'gstRate', 'hsnCode'].map((field) => (
                <input
                  key={field}
                  className="form-control my-2"
                  placeholder={field}
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                />
              ))}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button onClick={handleAddItem} className="btn btn-success">Add</button>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showPurchaseModal && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h5>Purchase Tracking</h5>
              {['companyName', 'gstNumber', 'address', 'stateName', 'invoiceNumber', 'invoiceDate'].map(field => (
                <input
                  key={field}
                  className="form-control my-2"
                  placeholder={field.replace(/([A-Z])/g, ' $1')}
                  name={field}
                  type={field === 'invoiceDate' ? 'date' : 'text'}
                  value={purchaseData[field]}
                  onChange={handlePurchaseChange}
                />
              ))}
              <h6>Items Purchased</h6>
              {purchaseData.itemsPurchased.map((item, idx) => (
                <div key={idx} className="d-flex gap-2 mb-2">
                  {['name', 'description', 'price', 'quantity'].map(field => (
                    <input
                      key={field}
                      className="form-control"
                      placeholder={field}
                      value={item[field]}
                      onChange={(e) => handleItemChange(idx, field, e.target.value)}
                    />
                  ))}
                </div>
              ))}
              <button className="btn btn-sm btn-outline-primary mb-2" onClick={addPurchaseItemRow}>Add Item</button>
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button onClick={() => setShowPurchaseModal(false)} className="btn btn-success">Submit Purchase</button>
                <button onClick={() => setShowPurchaseModal(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
