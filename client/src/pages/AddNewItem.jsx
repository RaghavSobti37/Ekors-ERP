import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/Navbar.css";

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

    const handleSubmit = (e) => {
        e.preventDefault();
        // Here you would typically send the data to your backend
        console.log("Submitted items:", items);
        alert("Items saved successfully!");
        onClose();
    };

    return (
        <div>
            <Navbar />
            <div className="full-screen-modal-overlay">
                <div className="full-screen-modal">
                    <button className="close-btn" onClick={onClose}>✖</button>
                    <h2>Add New Items</h2>

                    <form onSubmit={handleSubmit}>
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
                                                <option value="kg">kg</option>
                                                <option value="g">g</option>
                                                <option value="l">l</option>
                                                <option value="ml">ml</option>
                                                <option value="piece">piece</option>
                                                <option value="box">box</option>
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
                                            <button
                                                type="button"
                                                className="delete-btn"
                                                onClick={() => removeRow(item.id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="add-row-btn"
                                onClick={addNewRow}
                            >
                                Add Row
                            </button>
                            <button type="submit" className="save-btn">
                                Save Items
                            </button>
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddNewItem;