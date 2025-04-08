import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './css/Items.css'; // Optional for modal styling

export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', quantity: '', price: '', gstRate: '', hsnCode: '' });
  const [showModal, setShowModal] = useState(false);
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

  const initializeDatabase = async () => {
    try {
      setLoading(true);
      await axios.post('http://localhost:3000/api/items/initialize');
      await fetchItems();
    } catch (error) {
      console.error('Error initializing database:', error);
    } finally {
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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container">
      <h2>Items List</h2>

      <div className="mb-3 d-flex gap-2">
        <button onClick={initializeDatabase} className="btn btn-primary">Initialize DB</button>
        <button onClick={() => setShowModal(true)} className="btn btn-success">Add Item</button>
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
          <thead className="thead-dark">
            <tr>
              {['name', 'quantity', 'price', 'gstRate', 'hsnCode'].map((key) => (
                <th key={key} onClick={() => requestSort(key)} style={{ cursor: 'pointer' }}>
                  {key.charAt(0).toUpperCase() + key.slice(1)} {sortConfig.key === key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item) => (
              <tr key={item._id}>
                {editingItem === item._id ? (
                  <>
                    {['name', 'quantity', 'price', 'gstRate', 'hsnCode'].map((field) => (
                      <td key={field}>
                        <input
                          name={field}
                          value={formData[field]}
                          onChange={handleChange}
                          className="form-control"
                        />
                      </td>
                    ))}
                    <td>
                      <button onClick={handleSave} className="btn btn-success btn-sm mr-1">Save</button>
                      <button onClick={handleCancel} className="btn btn-secondary btn-sm">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.price.toFixed(2)}</td>
                    <td>{item.gstRate}%</td>
                    <td>{item.hsnCode}</td>
                    <td>
                      <button onClick={() => handleEdit(item)} className="btn btn-primary btn-sm">Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="d-flex justify-content-center gap-3 mt-2">
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Modal for Add Item */}
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
    </div>
  );
}
