import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Form,
  Button as BsButton,
  Alert,
  Spinner,
  Row,
  Col,
  Table,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { showToast, handleApiError } from "../utils/helpers";
import ReusablePageStructure from "../components/ReusablePageStructure.jsx";
import ItemSearchComponent from "../components/ItemSearch.jsx";
import { useAuth } from "../context/AuthContext.jsx"; // Corrected import
import axios from "axios"; // For pincode API
import LoadingSpinner from "../components/LoadingSpinner.jsx"; // Import LoadingSpinner

const PurchaseFormPage = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth(); // Get auth loading state

  const initialPurchaseData = {
    companyName: "",
    gstNumber: "",
    address: { address1: "", address2: "", city: "", state: "", pincode: "" }, // Structured address
    stateName: "", // Flat state name for backend
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    items: [], // Items will be added here
  };

  const [purchaseData, setPurchaseData] = useState(initialPurchaseData);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [isItemSearchDropdownOpen, setIsItemSearchDropdownOpen] =
    useState(false);
  const [fieldErrors, setFieldErrors] = useState({}); // For tracking field-specific errors

  const handlePurchaseChange = useCallback((e) => {
    setPurchaseData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handlePincodeChangeForAddress = useCallback(async (pincode) => {
    // Update pincode in state immediately
    setPurchaseData((prev) => ({
      ...prev,
      address: { ...prev.address, pincode },
    }));

    if (pincode.length === 6) {
      setIsFetchingAddress(true);
      try {
        const response = await axios.get(
          `https://api.postalpincode.in/pincode/${pincode}`
        );
        const data = response.data[0];
        if (data.Status === "Success") {
          const postOffice = data.PostOffice[0];
          setPurchaseData((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              city: postOffice.District,
              state: postOffice.State,
              pincode: pincode, // Ensure pincode is also set here
            },
            stateName: postOffice.State, // Update stateName directly
          }));
          showToast(`City and State auto-filled for pincode ${pincode}.`, true);
        } else {
          showToast(`Pincode ${pincode} not found or invalid.`, false);
        }
      } catch (err) {
        showToast("Error fetching address from pincode.", false);
      } finally {
        setIsFetchingAddress(false);
      }
    }
  }, []);

  const handleItemChange = useCallback((index, field, value) => {
    setPurchaseData((prev) => {
      const updatedItems = [...prev.items];
      // Convert quantity and price to numbers, otherwise keep as is
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: ["quantity", "price"].includes(field) ? Number(value) : value,
      };
      return { ...prev, items: updatedItems };
    });
  }, []);

  const handleAddItemToPurchase = useCallback((item) => {
    setPurchaseData((prev) => {
      const newItem = {
        itemId: item._id, // Store item ID
        description: item.name,
        hsnSacCode: item.hsnCode,
        quantity: 1, // Default quantity
        unit: item.baseUnit,
        price: item.buyingPrice || 0, // Use item's average buying price as a default, user will edit
        gstRate: item.gstRate,
        profitMarginPercentage: item.profitMarginPercentage || 20,
        originalItem: item, // Store the original item to access its units
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  }, []);

  const removeItem = useCallback((index) => {
    setPurchaseData((prev) => {
      const updatedItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: updatedItems };
    });
  }, []);

  const calculateTotalAmount = useCallback(() => {
    return purchaseData.items.reduce((total, item) => {
      const itemSubtotal =
        (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
      const itemGst = itemSubtotal * ((parseFloat(item.gstRate) || 0) / 100);
      return total + itemSubtotal + itemGst;
    }, 0);
  }, [purchaseData.items]);

  const isPurchaseDataValid = useCallback(() => {
    if (
      !purchaseData.companyName ||
      !purchaseData.invoiceNumber ||
      !purchaseData.date
    ) {
      return false;
    }
    if (purchaseData.items.length === 0) {
      return false;
    }
    for (const item of purchaseData.items) {
      if (
        !item.description ||
        !item.unit ||
        !(parseFloat(item.quantity) > 0) ||
        !(parseFloat(item.price) >= 0)
      ) {
        return false;
      }
    }
    return true;
  }, [purchaseData]);

  const handleSubmitPurchase = useCallback(async () => {
    if (!isPurchaseDataValid()) {
      setError("Please fill in all required purchase fields and item details.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare address for backend (flat string)
      const addressString = `${purchaseData.address.address1}, ${purchaseData.address.address2}, ${purchaseData.address.city}, ${purchaseData.address.state}, ${purchaseData.address.pincode}`;

      const processedItems = purchaseData.items.map((item) => {
        const { originalItem, unit: selectedUnitName, quantity, price } = item;

        if (!originalItem?.units || !selectedUnitName) return item;

        const selectedUnitInfo = originalItem.units.find(
          (u) => u.name === selectedUnitName
        );
        const baseUnitInfo = originalItem.units.find((u) => u.isBaseUnit);

        if (
          !selectedUnitInfo ||
          !baseUnitInfo ||
          selectedUnitInfo.name === baseUnitInfo.name
        ) {
          return item; // No conversion needed or possible
        }

        const conversionFactor = selectedUnitInfo.conversionFactor || 1;
        const quantityInBaseUnit = (quantity || 0) * conversionFactor;
        const pricePerBaseUnit =
          conversionFactor > 0 ? (price || 0) / conversionFactor : 0;

        return {
          ...item,
          quantity: quantityInBaseUnit,
          unit: baseUnitInfo.name,
          price: pricePerBaseUnit,
        };
      });

      const payload = {
        ...purchaseData,
        address: addressString,
        items: processedItems,
      };

      await apiClient("/items/purchase", { method: "POST", body: payload });
      showToast("Purchase added successfully! Item quantities updated.", true);
      setPurchaseData(initialPurchaseData);
      setFieldErrors({});
      navigate("/items");
    } catch (err) {
      // Try to extract field-specific errors from backend
      let errorMessage = "Failed to add purchase.";
      let errors = {};
      if (err?.response?.data) {
        if (err.response.data.errors) {
          // Mongoose validation error format
          errors = err.response.data.errors;
          errorMessage = "Please correct the highlighted fields.";
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      }
      setError(errorMessage);
      setFieldErrors(errors);
    } finally {
      setIsSubmitting(false);
    }
  }, [purchaseData, isPurchaseDataValid, initialPurchaseData, navigate, user]);

  if (authLoading) {
    return <LoadingSpinner show={true} />;
  }

  return (
    <ReusablePageStructure
      title="Add New Purchase"
      footerContent={
        <>
          <BsButton
            variant="secondary"
            onClick={() => navigate("/items")}
            disabled={isSubmitting}
          >
            Cancel
          </BsButton>
          <BsButton
            variant="primary"
            onClick={handleSubmitPurchase}
            disabled={!isPurchaseDataValid() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />{" "}
                Submitting...
              </>
            ) : (
              "Submit Purchase"
            )}
          </BsButton>
        </>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form>
        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Company Name*</Form.Label>
              <Form.Control
                type="text"
                name="companyName"
                value={purchaseData.companyName}
                onChange={handlePurchaseChange}
                required
                disabled={isSubmitting}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>GST Number</Form.Label>
              <Form.Control
                type="text"
                name="gstNumber"
                value={purchaseData.gstNumber}
                onChange={handlePurchaseChange}
                disabled={isSubmitting}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Address Line 1</Form.Label>
              <Form.Control
                type="text"
                name="address1"
                value={purchaseData.address.address1 || ""}
                onChange={(e) =>
                  setPurchaseData((prev) => ({
                    ...prev,
                    address: { ...prev.address, address1: e.target.value },
                  }))
                }
                placeholder="Address line 1"
                disabled={isSubmitting || isFetchingAddress}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Address Line 2</Form.Label>
              <Form.Control
                type="text"
                name="address2"
                value={purchaseData.address.address2 || ""}
                onChange={(e) =>
                  setPurchaseData((prev) => ({
                    ...prev,
                    address: { ...prev.address, address2: e.target.value },
                  }))
                }
                placeholder="Address line 2"
                disabled={isSubmitting || isFetchingAddress}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label>Pincode</Form.Label>
              <Form.Control
                type="text"
                name="pincode"
                value={purchaseData.address.pincode || ""}
                onChange={(e) => handlePincodeChangeForAddress(e.target.value)}
                placeholder="Pincode"
                disabled={isSubmitting || isFetchingAddress}
              />
              <Form.Text className="text-muted">6-digit</Form.Text>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>City</Form.Label>
              <Form.Control
                type="text"
                name="city"
                value={purchaseData.address.city || ""}
                onChange={(e) =>
                  setPurchaseData((prev) => ({
                    ...prev,
                    address: { ...prev.address, city: e.target.value },
                  }))
                }
                placeholder="City"
                readOnly={!isFetchingAddress && !!purchaseData.address.city}
                disabled={isSubmitting || isFetchingAddress}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>State</Form.Label>
              <Form.Control
                type="text"
                name="stateName"
                value={purchaseData.stateName || ""} // This is the field sent to backend
                onChange={handlePurchaseChange} // Directly update stateName
                placeholder="State"
                readOnly={!isFetchingAddress && !!purchaseData.stateName}
                disabled={isSubmitting || isFetchingAddress}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Invoice Number*</Form.Label>
              <Form.Control
                type="text"
                name="invoiceNumber"
                value={purchaseData.invoiceNumber}
                onChange={handlePurchaseChange}
                required
                disabled={isSubmitting}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Invoice Date*</Form.Label>
              <Form.Control
                type="date"
                name="date"
                value={purchaseData.date}
                onChange={handlePurchaseChange}
                required
                disabled={isSubmitting}
              />
            </Form.Group>
          </Col>
        </Row>

        <h5 className="mt-4 mb-3">Items Purchased</h5>
        <ItemSearchComponent
          onItemSelect={handleAddItemToPurchase}
          onDropdownToggle={setIsItemSearchDropdownOpen}
          placeholder="Search and add item..."
        />
        {
          isItemSearchDropdownOpen && (
            <div style={{ height: "200px" }}></div>
          ) /* Spacer for open dropdown */
        }

        <div className="table-responsive mt-3">
          <Table bordered hover size="sm">
            <thead className="table-light">
              <tr>
                <th>Description</th>
                <th>HSN/SAC</th>
                <th>Qty*</th>
                <th>Unit*</th>
                <th>Total Purchase Price*</th>
                <th>GST%</th>
                <th>Profit Margin %</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseData.items.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center text-muted">
                    No items added yet. Search and add above.
                  </td>
                </tr>
              ) : (
                purchaseData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <Form.Control
                        type="text"
                        value={item.description || ""}
                        onChange={(e) =>
                          handleItemChange(idx, "description", e.target.value)
                        }
                        placeholder="Description"
                        required
                        disabled={isSubmitting}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="text"
                        value={item.hsnSacCode || ""}
                        onChange={(e) =>
                          handleItemChange(idx, "hsnSacCode", e.target.value)
                        }
                        placeholder="HSN/SAC"
                        disabled={isSubmitting}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        value={item.quantity || ""}
                        onChange={(e) =>
                          handleItemChange(idx, "quantity", e.target.value)
                        }
                        placeholder="Qty"
                        required
                        min="0"
                        disabled={isSubmitting}
                      />
                    </td>
                    <td>
                      {item.originalItem &&
                      item.originalItem.units &&
                      item.originalItem.units.length > 0 ? (
                        <Form.Control
                          as="select"
                          value={item.unit || ""}
                          onChange={(e) =>
                            handleItemChange(idx, "unit", e.target.value)
                          }
                          required
                          disabled={isSubmitting}
                        >
                          {item.originalItem.units.map((unitOption) => (
                            <option
                              key={unitOption.name}
                              value={unitOption.name}
                            >
                              {unitOption.name}
                            </option>
                          ))}
                        </Form.Control>
                      ) : (
                        <Form.Control
                          type="text"
                          value={item.unit || ""}
                          onChange={(e) =>
                            handleItemChange(idx, "unit", e.target.value)
                          }
                          placeholder="Unit"
                          required
                          disabled={isSubmitting}
                        />
                      )}
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        step="0.01"
                        value={item.price || ""}
                        onChange={(e) =>
                          handleItemChange(idx, "price", e.target.value)
                        }
                        placeholder="Total Purchase Price"
                        required
                        min="0"
                        disabled={isSubmitting}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        step="0.01"
                        value={item.gstRate || "0"}
                        onChange={(e) =>
                          handleItemChange(idx, "gstRate", e.target.value)
                        }
                        placeholder="GST %"
                        min="0"
                        disabled={isSubmitting}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        step="0.01"
                        value={item.profitMarginPercentage || ""}
                        onChange={(e) =>
                          handleItemChange(
                            idx,
                            "profitMarginPercentage",
                            e.target.value
                          )
                        }
                        placeholder="Profit %"
                        min="0"
                        disabled={isSubmitting}
                        title="This will update the item's stored profit margin."
                      />
                    </td>
                    <td className="align-middle text-end">
                      {(
                        (parseFloat(item.quantity) || 0) *
                        (parseFloat(item.price) || 0)
                      ).toFixed(2)}
                    </td>
                    <td className="align-middle text-center">
                      <BsButton
                        variant="danger"
                        size="sm"
                        onClick={() => removeItem(idx)}
                        disabled={
                          isSubmitting || purchaseData.items.length === 1
                        }
                      >
                        Remove
                      </BsButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>

        <div className="d-flex justify-content-end mt-3">
          <strong>Total Amount: ₹{calculateTotalAmount().toFixed(2)}</strong>
        </div>
      </Form>
    </ReusablePageStructure>
  );
};

export default PurchaseFormPage;
