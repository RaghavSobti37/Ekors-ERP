import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/AddNewItem.css";

const AddNewItem = ({ onClose }) => {
    const [items, setItems] = useState([
        { id: 1, name: "", category: "", subcategory: "", quantity: "", price: "", unit: "", gstRate: "" }
    ]);
    const navigate = useNavigate();

    const handleInputChange = (id, field, value) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const addNewRow = () => {
        setItems([...items, {
            id: items.length + 1,
            name: "",
            category: "",
            subcategory: "",
            quantity: "",
            price: "",
            unit: "",
            gstRate: ""
        }]);
    };

    const removeRow = (id) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleView = (id) => {
        const itemToView = items.find(item => item.id === id);
        alert(`Viewing item:\nName: ${itemToView.name}\nCategory: ${itemToView.category}\nPrice: ${itemToView.price}`);
    };

    const handleEdit = (id) => {
        const itemToEdit = items.find(item => item.id === id);
        alert(`Editing item with ID: ${id}`);
        // You would typically set some state here to enter edit mode
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Here you would typically send the data to your backend
        console.log("Submitted items:", items);
        alert("Items saved successfully!");
        onClose();
    };

    return (
        <div className="add-item-container">
            <div className="full-screen-modal-overlay">
                <div className="full-screen-modal">
                    <div className="modal-header">
                        <h2>Add New Items</h2>
                        <button className="close-btn" onClick={onClose}>✖</button>
                    </div>

                    <form onSubmit={handleSubmit} className="item-form">
                        <div className="table-container">
                            <table className="item-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Subcategory</th>
                                        <th>Quantity</th>
                                        <th>Price</th>
                                        <th>Unit</th>
                                        <th>GST Rate</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleInputChange(item.id, 'name', e.target.value)}
                                                    required
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.category}
                                                    onChange={(e) => handleInputChange(item.id, 'category', e.target.value)}
                                                    required
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.subcategory}
                                                    onChange={(e) => handleInputChange(item.id, 'subcategory', e.target.value)}
                                                    required
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleInputChange(item.id, 'quantity', e.target.value)}
                                                    required
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => handleInputChange(item.id, 'price', e.target.value)}
                                                    required
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    value={item.unit}
                                                    onChange={(e) => handleInputChange(item.id, 'unit', e.target.value)}
                                                    required
                                                >
                                                    <option value="">Select Unit</option>
                                                    <option value="KG">KG</option>
                                                    <option value="Nos">Nos</option>
                                                    <option value="Mtr">Mtr</option>
                                                    <option value="PKT">PKT</option>
                                                    <option value="Pair">Pair</option>
                                                    <option value="Set">Set</option>
                                                    <option value="Bottle">Bottle</option>
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    value={item.gstRate}
                                                    onChange={(e) => handleInputChange(item.id, 'gstRate', e.target.value)}
                                                    required
                                                >
                                                    <option value="">Select GST Rate</option>
                                                    <option value="0">0%</option>
                                                    <option value="5">5%</option>
                                                    <option value="12">12%</option>
                                                    <option value="18">18%</option>
                                                    <option value="28">28%</option>
                                                </select>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        type="button"
                                                        className="view-btn"
                                                        onClick={() => handleView(item.id)}
                                                    >
                                                        👁️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="edit-btn"
                                                        onClick={() => handleEdit(item.id)}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="delete-btn"
                                                        onClick={() => removeRow(item.id)}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="form-actions">
                            <div className="action-group">
                                <button
                                    type="button"
                                    className="add-row-btn"
                                    onClick={addNewRow}
                                >
                                    Add Row
                                </button>
                            </div>
                            <div className="action-group">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={onClose}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="save-btn">
                                    Save Items
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddNewItem;