import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/Navbar.css";
import Navbar from '../components/Navbar';
import "../css/AddNewItem.css";
import { motion, AnimatePresence } from "framer-motion";

const AddNewItem = ({ onClose }) => {
    const [items, setItems] = useState([
        { id: 1, name: "", category: "", subcategory: "", quantity: "", price: "", unit: "", gstRate: "" }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleInputChange = (id, field, value) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const addNewRow = () => {
        setItems([...items, {
            id: Date.now(), // Using timestamp for unique IDs
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
        } else {
            // Shake animation for the last row
            const lastRow = document.querySelector(`tr[data-id="${id}"]`);
            if (lastRow) {
                lastRow.classList.add("shake");
                setTimeout(() => lastRow.classList.remove("shake"), 500);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log("Submitted items:", items);
            
            // Show success notification
            document.querySelector(".notification").classList.add("show");
            setTimeout(() => {
                document.querySelector(".notification").classList.remove("show");
                onClose();
            }, 2000);
        } catch (error) {
            console.error("Error saving items:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Animation variants
    const rowVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.3 }
        },
        exit: { opacity: 0, x: -50 }
    };

    return (
        <div className="add-item-container">
            <Navbar />
            <div className="full-screen-modal-overlay">
                <motion.div 
                    className="full-screen-modal"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                >
                    <div className="modal-header">
                        <h2>Add New Items</h2>
                        <button className="close-btn" onClick={onClose}>
                            <span>✖</span>
                        </button>
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
                                    <AnimatePresence>
                                        {items.map((item) => (
                                            <motion.tr 
                                                key={item.id}
                                                data-id={item.id}
                                                variants={rowVariants}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                            >
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => handleInputChange(item.id, 'name', e.target.value)}
                                                        placeholder="Item name"
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.category}
                                                        onChange={(e) => handleInputChange(item.id, 'category', e.target.value)}
                                                        placeholder="Category"
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.subcategory}
                                                        onChange={(e) => handleInputChange(item.id, 'subcategory', e.target.value)}
                                                        placeholder="Subcategory"
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleInputChange(item.id, 'quantity', e.target.value)}
                                                        placeholder="0"
                                                        min="0"
                                                        step="0.01"
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <div className="price-input">
                                                        <span>₹</span>
                                                        <input
                                                            type="number"
                                                            value={item.price}
                                                            onChange={(e) => handleInputChange(item.id, 'price', e.target.value)}
                                                            placeholder="0.00"
                                                            min="0"
                                                            step="0.01"
                                                            required
                                                        />
                                                    </div>
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
                                                        <option value="">Select GST</option>
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
                                                        title="Remove row"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                                        </svg>
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        <div className="form-actions">
                            <motion.button
                                type="button"
                                className="add-row-btn"
                                onClick={addNewRow}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Add Row
                            </motion.button>
                            
                            <div className="action-group">
                                <motion.button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={onClose}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button 
                                    type="submit" 
                                    className="save-btn"
                                    disabled={isSubmitting}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {isSubmitting ? (
                                        <span className="spinner"></span>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                                <polyline points="7 3 7 8 15 8"></polyline>
                                            </svg>
                                            Save Items
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </form>
                    
                    <div className="notification">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Items saved successfully!</span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AddNewItem;