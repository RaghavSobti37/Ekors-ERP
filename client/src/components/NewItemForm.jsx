import React, { useState, useEffect } from "react";
import { Form, Button, Row, Col, Alert, InputGroup } from "react-bootstrap";

const UNIT_OPTIONS = [
  'nos', 'pkt', 'pcs', 'kgs', 'mtr', 'sets', 'kwp', 'ltr', 'bottle', 'each', 'bag', 'set'
];

const initialForm = {
  name: "",
  sellingPrice: "",
  buyingPrice: "",
  baseUnit: "nos",
  category: "",
  hsnCode: "",
  gstRate: "0",
};

export default function NewItemForm({ onSubmit, isSaving, error, success }) {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/items/categories/all");
        const data = await res.json();
        setCategories(data.categories || []);
      } catch {
        setCategories([]);
      }
    }
    fetchCategories();
  }, []);

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.sellingPrice || isNaN(form.sellingPrice)) errors.sellingPrice = "Selling price required";
    if (!form.baseUnit) errors.baseUnit = "Unit is required";
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (e) => {
    setForm((prev) => ({ ...prev, category: e.target.value }));
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    setIsAddingCategory(true);
    try {
      // Optionally, call backend to add category
      setCategories((prev) => [...prev, newCategory.trim()]);
      setForm((prev) => ({ ...prev, category: newCategory.trim() }));
      setNewCategory("");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      onSubmit({
        ...form,
        pricing: {
          sellingPrice: form.sellingPrice,
          buyingPrice: form.buyingPrice,
          baseUnit: form.baseUnit,
        },
        units: [
          { name: form.baseUnit, isBaseUnit: true, conversionFactor: 1 },
        ],
      });
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <Row>
        <Col md={6}>
          <Form.Group className="mb-2">
            <Form.Label>Item Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              isInvalid={!!fieldErrors.name}
              required
            />
            <Form.Control.Feedback type="invalid">{fieldErrors.name}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-2">
            <Form.Label>Selling Price <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="number"
              name="sellingPrice"
              value={form.sellingPrice}
              onChange={handleChange}
              isInvalid={!!fieldErrors.sellingPrice}
              required
            />
            <Form.Control.Feedback type="invalid">{fieldErrors.sellingPrice}</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-2">
            <Form.Label>Unit <span className="text-danger">*</span></Form.Label>
            <Form.Select
              name="baseUnit"
              value={form.baseUnit}
              onChange={handleChange}
              isInvalid={!!fieldErrors.baseUnit}
              required
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">{fieldErrors.baseUnit}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-2">
            <Form.Label>HSN/SAC Code</Form.Label>
            <Form.Control
              type="text"
              name="hsnCode"
              value={form.hsnCode}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>
      </Row>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-2">
            <Form.Label>GST Rate (%)</Form.Label>
            <Form.Control
              type="number"
              name="gstRate"
              value={form.gstRate}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-2">
            <Form.Label>Category</Form.Label>
            <InputGroup>
              <Form.Select
                name="category"
                value={form.category}
                onChange={handleCategoryChange}
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Form.Select>
              <Form.Control
                type="text"
                placeholder="Add new category"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                style={{ maxWidth: 150 }}
              />
              <Button
                variant="outline-success"
                onClick={handleAddCategory}
                disabled={isAddingCategory || !newCategory.trim()}
              >
                +
              </Button>
            </InputGroup>
          </Form.Group>
        </Col>
      </Row>
      <Button type="submit" variant="success" disabled={isSaving} className="mt-2">
        {isSaving ? "Saving..." : "Save Item"}
      </Button>
    </Form>
  );
}
