import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../utils/apiClient";
import { Alert, Button, Spinner, Table, Form, Card, Row, Col, OverlayTrigger, Tooltip } from "react-bootstrap";
import ReusablePageStructure from "../../components/ReusablePageStructure";
import { Trash } from "react-bootstrap-icons";

// Standard units (should match backend)
const STANDARD_UNITS = [
  "nos", "pkt", "pcs", "kgs", "mtr", "sets", "kwp", "ltr", "bottle", "each", "bag", "set"
];

export default function EditItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  // For adding a new unit
  const [newUnit, setNewUnit] = useState({ name: "", conversionFactor: "" });

  useEffect(() => {
    apiClient(`/items/${id}`)
      .then((item) => {
        // Ensure units are present and at least one base unit
        if (!item.units || !item.units.length) {
          item.units = [
            {
              name: item.baseUnit || "nos",
              isBaseUnit: true,
              conversionFactor: 1,
            },
          ];
        }
        setFormData(item);
      })
      .catch(() => setError("Failed to load item."));
  }, [id]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Handle unit change (for conversionFactor or name)
  const handleUnitChange = (idx, field, value) => {
    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((u, i) =>
        i === idx
          ? {
              ...u,
              [field]:
                field === "conversionFactor"
                  ? value.replace(/[^0-9.]/g, "")
                  : value,
            }
          : u
      ),
    }));
  };

  // Handle base unit selection
  const handleBaseUnitSelect = (idx) => {
    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((u, i) => ({
        ...u,
        isBaseUnit: i === idx,
        conversionFactor: i === idx ? 1 : u.conversionFactor,
      })),
      baseUnit: prev.units[idx].name,
    }));
  };

  // Add a new unit
  const handleAddUnit = () => {
    setError(null);
    if (
      !newUnit.name ||
      !STANDARD_UNITS.includes(newUnit.name) ||
      newUnit.conversionFactor === "" ||
      isNaN(Number(newUnit.conversionFactor)) ||
      Number(newUnit.conversionFactor) <= 0
    ) {
      setError("Please provide a valid unit and conversion factor (> 0).");
      return;
    }
    if (formData.units.some((u) => u.name === newUnit.name)) {
      setError("This unit already exists for this item.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          name: newUnit.name,
          isBaseUnit: false,
          conversionFactor: parseFloat(Number(newUnit.conversionFactor).toFixed(2)),
        },
      ],
    }));
    setNewUnit({ name: "", conversionFactor: "" });
  };

  // Remove a unit (not allowed for base unit)
  const handleRemoveUnit = (idx) => {
    if (formData.units[idx].isBaseUnit) return;
    if (window.confirm("Are you sure you want to delete this unit?")) {
      setFormData((prev) => ({
        ...prev,
        units: prev.units.filter((_, i) => i !== idx),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient(`/items/${id}`, {
        method: "PUT",
        body: {
          ...formData,
          quantity: parseFloat(formData.quantity) || 0,
          sellingPrice: parseFloat(formData.sellingPrice) || 0,
          buyingPrice: parseFloat(formData.buyingPrice) || 0,
          gstRate: parseFloat(formData.gstRate) || 0,
          maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
          units: formData.units.map((u) => ({
            name: u.name,
            isBaseUnit: !!u.isBaseUnit,
            conversionFactor: u.isBaseUnit ? 1 : parseFloat(Number(u.conversionFactor).toFixed(2)),
          })),
          baseUnit: formData.units.find((u) => u.isBaseUnit)?.name || formData.baseUnit,
        },
      });
      setSuccess("Item updated successfully!");
      setTimeout(() => navigate("/items"), 1200);
    } catch (err) {
      setError("Failed to update item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!formData)
    return (
      <ReusablePageStructure title="Edit Item">
        <Spinner animation="border" />
      </ReusablePageStructure>
    );

  // Conversion Table
  const baseUnit = formData.units.find((u) => u.isBaseUnit);

  return (
    <ReusablePageStructure title={`Edit Item: ${formData.name}`}>
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Form onSubmit={handleSubmit} autoComplete="off">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            <Row>
              <Col md={6}>
                <h5 className="mb-3">Basic Details</h5>
                <Form.Group className="mb-2">
                  <Form.Label>Name*</Form.Label>
                  <Form.Control
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control
                    name="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Selling Price (per {formData.baseUnit})</Form.Label>
                  <Form.Control
                    name="sellingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Buying Price (per {formData.baseUnit})</Form.Label>
                  <Form.Control
                    name="buyingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.buyingPrice}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>GST Rate (%)</Form.Label>
                  <Form.Control
                    name="gstRate"
                    type="number"
                    value={formData.gstRate}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>HSN Code</Form.Label>
                  <Form.Control
                    name="hsnCode"
                    value={formData.hsnCode}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Category</Form.Label>
                  <Form.Control
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Max Discount (%)</Form.Label>
                  <Form.Control
                    name="maxDiscountPercentage"
                    type="number"
                    value={formData.maxDiscountPercentage}
                    onChange={handleChange}
                    min="0"
                    max="100"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <h5 className="mb-3">Image & Units</h5>
                <Form.Group className="mb-2">
                  <Form.Label>Image</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () =>
                          setFormData((prev) => ({
                            ...prev,
                            image: reader.result,
                          }));
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {formData.image && (
                    <img
                      src={formData.image}
                      alt="Preview"
                      style={{
                        width: 100,
                        height: 100,
                        objectFit: "cover",
                        borderRadius: 4,
                        border: "1px solid #ddd",
                        marginTop: 8,
                      }}
                    />
                  )}
                </Form.Group>
                <hr />
                <h6 className="mb-2">Units & Conversion</h6>
                <Table bordered size="sm" className="mb-2">
                  <thead>
                    <tr>
                      <th>Base?</th>
                      <th>Unit Name</th>
                      <th>Conversion Factor</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.units.map((u, idx) => (
                      <tr key={u.name}>
                        <td className="text-center">
                          <Form.Check
                            type="radio"
                            name="baseUnit"
                            checked={!!u.isBaseUnit}
                            onChange={() => handleBaseUnitSelect(idx)}
                            disabled={u.isBaseUnit}
                            title={u.isBaseUnit ? "This is the base unit" : "Set as base unit"}
                          />
                        </td>
                        <td>
                          <Form.Select
                            value={u.name}
                            disabled={u.isBaseUnit}
                            onChange={(e) =>
                              handleUnitChange(idx, "name", e.target.value)
                            }
                          >
                            {STANDARD_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </Form.Select>
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            value={u.isBaseUnit ? 1 : u.conversionFactor}
                            min={u.isBaseUnit ? 1 : 0.01}
                            step="0.01"
                            disabled={u.isBaseUnit}
                            onChange={(e) =>
                              handleUnitChange(idx, "conversionFactor", e.target.value)
                            }
                          />
                        </td>
                        <td className="text-center">
                          {!u.isBaseUnit && (
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Delete this unit</Tooltip>}
                            >
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleRemoveUnit(idx)}
                              >
                                <Trash />
                              </Button>
                            </OverlayTrigger>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Form
                  className="d-flex gap-2 align-items-end mb-2"
                  onSubmit={handleAddUnit}
                  autoComplete="off"
                >
                  <Form.Group>
                    <Form.Label visuallyHidden>Add Unit</Form.Label>
                    <Form.Select
                      value={newUnit.name}
                      onChange={(e) =>
                        setNewUnit((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select unit</option>
                      {STANDARD_UNITS.filter(
                        (u) => !formData.units.some((unit) => unit.name === u)
                      ).map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label visuallyHidden>Conversion</Form.Label>
                    <Form.Control
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Conversion"
                      value={newUnit.conversionFactor}
                      onChange={(e) =>
                        setNewUnit((prev) => ({
                          ...prev,
                          conversionFactor: e.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddUnit}
                  >
                    Add Unit
                  </Button>
                </Form>
                {/* Conversion Table */}
                {formData.units.length > 1 && baseUnit && (
                  <div className="mt-3">
                    <h6>Conversion Table</h6>
                    <Table bordered size="sm">
                      <thead>
                        <tr>
                          <th>Unit</th>
                          <th>Equals (in {baseUnit.name})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.units
                          .filter((u) => !u.isBaseUnit)
                          .map((u) => (
                            <tr key={u.name}>
                              <td>1 {u.name}</td>
                              <td>
                                {parseFloat(u.conversionFactor).toFixed(2)} {baseUnit.name}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Col>
            </Row>
            <div className="d-flex justify-content-end mt-4">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" animation="border" /> : "Update Item"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </ReusablePageStructure>
  );
}