import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../utils/apiClient";
import { Alert, Button, Spinner, Form } from "react-bootstrap";
import ReusablePageStructure from "../../components/ReusablePageStructure";
import { useAuth } from "../../context/AuthContext";
import { getInitialItemPayload, normalizeItemPayload, STANDARD_UNITS } from "../../utils/payloads";

export default function AddItemPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(getInitialItemPayload());
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    apiClient("/categories")
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient("/items", {
        method: "POST",
        body: normalizeItemPayload(formData),
      });
      navigate("/items");
    } catch (err) {
      setError("Failed to add item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ReusablePageStructure title="Add New Item">
      <form onSubmit={handleSubmit}>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="row">
          <div className="col-md-6">
            <label>Name*</label>
            <input className="form-control mb-2" name="name" value={formData.name} onChange={handleChange} required />
            <label>Quantity</label>
            <input className="form-control mb-2" name="quantity" type="number" value={formData.quantity} onChange={handleChange} />
            <label>GST Rate (%)</label>
            <input className="form-control mb-2" name="gstRate" type="number" value={formData.gstRate} onChange={handleChange} />
            <label>HSN Code</label>
            <input className="form-control mb-2" name="hsnCode" value={formData.hsnCode} onChange={handleChange} />
          </div>
          <div className="col-md-6">
            <label>Category</label>
            <Form.Select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="mb-2"
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat._id || cat} value={cat.name || cat}>
                  {cat.name || cat}
                </option>
              ))}
            </Form.Select>
            <label>Max Discount (%)</label>
            <input className="form-control mb-2" name="maxDiscountPercentage" type="number" value={formData.maxDiscountPercentage} onChange={handleChange} min="0" max="100" />
            <label>Image</label>
            <input className="form-control mb-2" type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => setFormData((prev) => ({ ...prev, image: reader.result }));
                reader.readAsDataURL(file);
              }
            }} />
            {formData.image && (
              <img src={formData.image} alt="Preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }} />
            )}
          </div>
        </div>
        <Button type="submit" className="mt-3" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" animation="border" /> : "Add Item"}
        </Button>
      </form>
    </ReusablePageStructure>
  );
}