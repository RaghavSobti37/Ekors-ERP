// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/minipages/quotations/QuotationFormPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Form, Button, Alert, Spinner, Table, Row, Col } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import ClientSearchComponent from "../../components/ClientSearchComponent.jsx";
import ItemSearchComponent from "../../components/ItemSearch.jsx";

import QuotationSearchComponent from "../../components/QuotationSearchComponent.jsx";

import apiClient from "../../utils/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  handleApiError,
  formatDateForInput,
} from "../../utils/helpers.js"; // Keep for formatting
import { calculateItemPriceAndQuantity } from "../../utils/unitConversion.js"; // Keep for frontend display calculations
const initialNewItemFormData = {
  name: "",
  pricing: {
    baseUnit: "nos",
    sellingPrice: "",
    buyingPrice: "",
  },
  units: [{ name: 'nos', isBaseUnit: true, conversionFactor: 1 }],
  category: "",
  hsnCode: "",
  gstRate: "0",
  quantity: 1, // This is for the item master, not the quotation line
  lowStockThreshold: "5",
};

const generateQuotationNumber = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
};

const GoodsTable = ({
  goods,
  handleGoodsChange,
  onAddItem,
  onDeleteItem,
  onAddSubtext,
  onDeleteSubtext,
  onItemSearchDropdownToggle,
  itemCreationMode,
  setItemCreationMode,
  newItemFormData,
  setNewItemFormData,
  handleSaveAndAddNewItemToQuotation,
  isSavingNewItem,
}) => {
  return (
    <div className="table-responsive">
      <Table bordered className="mb-3">
        <thead>
          <tr>
            <th>Sr No.</th>
            <th>
              Description <span className="text-danger">*</span>
            </th>
            <th>
              HSN/SAC <span className="text-danger">*</span>
            </th>
            <th>
              Qty <span className="text-danger">*</span>
            </th>
            <th style={{ minWidth: "100px" }}>
              Unit <span className="text-danger">*</span>
            </th>
            <th>
              Price <span className="text-danger">*</span>
            </th>
            <th>
              GST <span className="text-danger">*</span>
            </th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((item, index) => (
            <tr key={index}>
              <td>{item.srNo}</td>
              <td style={{ minWidth: "250px" }}>
                <Form.Control
                  required
                  type="text"
                  value={item.description || ""}
                  onChange={(e) =>
                    handleGoodsChange(index, "description", e.target.value)
                  }
                  placeholder="Item Description"
                />
                {item.subtexts &&
                  item.subtexts.map((subtext, subtextIndex) => (
                    <div key={subtextIndex} className="d-flex mt-1">
                      <Form.Control
                        type="text"
                        value={subtext}
                        onChange={(e) =>
                          handleGoodsChange(
                            index,
                            "subtexts",
                            e.target.value,
                            subtextIndex
                          )
                        }
                        placeholder={`Subtext ${subtextIndex + 1}`}
                        className="form-control-sm me-1"
                        style={{ fontStyle: "italic" }}
                      />
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => onDeleteSubtext(index, subtextIndex)}
                      >
                        &times;
                      </Button>
                    </div>
                  ))}
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="mt-1"
                  onClick={() => onAddSubtext(index)}
                >
                  + Subtext
                </Button>
              </td>
              <td>
                <Form.Control
                  required
                  type="text"
                  value={item.hsnCode || ""}
                  onChange={(e) =>
                    handleGoodsChange(index, "hsnCode", e.target.value)
                  }
                  placeholder="HSN/SAC"
                />
              </td>
              <td>
                <Form.Control
                  required
                  type="number"
                  min="1"
                  value={item.quantity || 1}
                  onChange={(e) =>
                    handleGoodsChange(index, "quantity", e.target.value)
                  }
                />
              </td>
              <td>
                {item.originalItem && item.originalItem.units && item.originalItem.units.length > 0 ? (
                  <Form.Control
                    as="select"
                    value={item.unit || item.originalItem.pricing?.baseUnit || "nos"}
                    onChange={(e) =>
                      handleGoodsChange(index, "unit", e.target.value)
                    }
                  >
                    {item.originalItem.units.map((unitOption) => (
                      <option key={unitOption.name} value={unitOption.name}>
                        {unitOption.name}
                      </option>
                    ))}
                  </Form.Control>
                ) : (
                  <Form.Control
                    type="text" value={item.unit || "nos"} readOnly
                  />
                )}
              </td>
              <td>
                <Form.Control
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price || 0}
                  onChange={(e) =>
                    handleGoodsChange(index, "price", e.target.value)
                  }
                />
              </td>
              <td>
                <Form.Control
                  required
                  type="number"
                  min="0"
                  step="0.1"
                  value={item.gstRate === null ? "" : item.gstRate}
                  onChange={(e) =>
                    handleGoodsChange(index, "gstRate", e.target.value)
                  }
                />
              </td>
              <td className="align-middle">₹{(item.amount || 0).toFixed(2)}</td>
              <td className="align-middle">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDeleteItem(index)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mb-3">
        <div className="d-flex gap-2 mb-2">
          {/* <Button
            variant={
              itemCreationMode === "search" ? "primary" : "outline-primary"
            }
            onClick={() => setItemCreationMode("search")}
            size="sm"
          >
            Search Existing Item
          </Button> */}
          <Button
            variant={itemCreationMode === "new" ? "primary" : "outline-primary"}
            onClick={() => setItemCreationMode("new")}
            size="sm"
          >
            Create New Item
          </Button>
        </div>

        {itemCreationMode === "search" && (
          <>
            <h6>Search and Add Existing Item</h6>
            <ItemSearchComponent
              onItemSelect={onAddItem}
              placeholder="Search items to add to quotation..."
              onDropdownToggle={onItemSearchDropdownToggle}
            />
          </>
        )}

        {itemCreationMode === "new" && (
          <>
            <h6>Create and Add New Item</h6>
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Item Name <span className="text-danger">*</span></Form.Label>
                    <Form.Control type="text" placeholder="Enter item name" value={newItemFormData.name} onChange={(e) => setNewItemFormData((prev) => ({ ...prev, name: e.target.value, }))} required />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Selling Price (per Base Unit) <span className="text-danger">*</span></Form.Label>
                    <Form.Control type="number" placeholder="Enter selling price" value={newItemFormData.pricing.sellingPrice} onChange={(e) => setNewItemFormData((prev) => ({ ...prev, pricing: { ...prev.pricing, sellingPrice: e.target.value } }))} required />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>Base Unit</Form.Label>
                    <Form.Control type="text" placeholder="e.g., nos, KG, Mtr" value={newItemFormData.pricing.baseUnit} onChange={(e) => setNewItemFormData((prev) => ({ ...prev, pricing: { ...prev.pricing, baseUnit: e.target.value }, units: [{ name: e.target.value, isBaseUnit: true, conversionFactor: 1 }] }))} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>HSN/SAC Code</Form.Label>
                    <Form.Control type="text" placeholder="HSN/SAC" value={newItemFormData.hsnCode} onChange={(e) => setNewItemFormData((prev) => ({ ...prev, hsnCode: e.target.value, }))} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>GST Rate (%)</Form.Label>
                    <Form.Control type="number" placeholder="GST Rate" value={newItemFormData.gstRate} onChange={(e) => setNewItemFormData((prev) => ({ ...prev, gstRate: e.target.value, }))} />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Category</Form.Label>
                    <Form.Control type="text" placeholder="Item Category" value={newItemFormData.category} onChange={(e) => setNewItemFormData((prev) => ({ ...prev, category: e.target.value, }))} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Low Stock Threshold</Form.Label>
                    <Form.Control type="number" placeholder="Default: 5" value={newItemFormData.lowStockThreshold} onChange={(e) => setNewItemFormData((prev) => ({ ...prev, lowStockThreshold: e.target.value, }))} />
                  </Form.Group>
                </Col>
              </Row>
              <Button
                variant="success"
                size="sm"
                className="mt-2"
                onClick={() => {handleSaveAndAddNewItemToQuotation (newItemFormData) , setItemCreationMode("search")}}
                disabled={
                  isSavingNewItem ||
                  !newItemFormData.name ||
                  !newItemFormData.pricing.sellingPrice ||
                  !newItemFormData.pricing.baseUnit
                }
              >
                {isSavingNewItem ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />{" "}
                    Saving Item...
                  </>
                ) : (
                  "Save Item & Add to Quotation"
                )}
              </Button>
            </Form>
          </>
        )}
      </div>
    </div>
  );
};

const QuotationFormPage = () => {
  const { id: quotationIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Add roundOffTotal to initial quotation data
  const getInitialQuotationData = useCallback((userId) => ({
    date: formatDateForInput(new Date()),
    referenceNumber: "",
    validityDate: formatDateForInput(
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    ),
    orderIssuedBy: userId || "",
    billingAddress: {
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
    },
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0,
    roundOffTotal: 0, // <-- Add this
    status: "open",
    client: {
      _id: null,
      companyName: "",
      clientName: "",
      gstNumber: "",
      email: "",
      phone: "",
    },
  }), []);

  // Update recalculateTotals to include roundOffTotal
  const recalculateTotals = useCallback((goodsList) => {
    const totalQuantity = goodsList.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const totalAmount = goodsList.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const gstAmount = goodsList.reduce(
      (sum, item) =>
        sum + Number(item.amount || 0) * (parseFloat(item.gstRate || 0) / 100),
      0
    );
    const grandTotal = totalAmount + gstAmount;
    const roundOffTotal = Math.round(grandTotal); // <-- Always round off
    return { totalQuantity, totalAmount, gstAmount, grandTotal, roundOffTotal };
  }, []);

  const [quotationData, setQuotationData] = useState(

    getInitialQuotationData(user?.id) // Always start with initial, then fetch/populate
  );
  const [isEditing, setIsEditing] = useState(
     !!quotationIdFromParams || location.state?.isEditing // Determine editing mode from URL or state

  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formValidated, setFormValidated] = useState(false);
  const [selectedClientIdForForm, setSelectedClientIdForForm] = useState(
    quotationData.client?._id || null
  );
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isFetchingBillingAddress, setIsFetchingBillingAddress] =
    useState(false);
  const [isItemSearchDropdownOpenInModal, setIsItemSearchDropdownOpenInModal] =
    useState(false);
  const [isReplicating, setIsReplicating] = useState(false);
  const [isLoadingReplicationDetails, setIsLoadingReplicationDetails] =
    useState(false);

  const [itemCreationMode, setItemCreationMode] = useState("search");
  const [newItemFormData, setNewItemFormData] = useState(
    initialNewItemFormData
  );
  const [isSavingNewItem, setIsSavingNewItem] = useState(false);
  const quotationFormId = "quotation-form-page";

  useEffect(() => {
    if (
      isEditing &&
      quotationIdFromParams &&
      !location.state?.quotationDataForForm
    ) {
      const fetchQuotation = async () => {
        setIsLoading(true);
        try {
          const fetchedQuotation = await apiClient(
            `/quotations/${quotationIdFromParams}`
          );
          const orderIssuedByIdToSet =
            fetchedQuotation.orderIssuedBy?._id ||
            fetchedQuotation.orderIssuedBy ||
            fetchedQuotation.user?._id ||
            fetchedQuotation.user ||
            user?.id;

          setQuotationData({
            date: formatDateForInput(fetchedQuotation.date),
            referenceNumber: fetchedQuotation.referenceNumber,
            validityDate: formatDateForInput(fetchedQuotation.validityDate),
            orderIssuedBy:
              typeof orderIssuedByIdToSet === "object" &&
              orderIssuedByIdToSet !== null
                ? orderIssuedByIdToSet._id
                : orderIssuedByIdToSet,
            goods: fetchedQuotation.goods.map((item) => ({
              ...item,
              quantity: Number(item.quantity),
              price: Number(item.price),
              amount: Number(item.amount),
              unit: item.unit || "nos",
              originalPrice: Number(item.originalPrice || item.price),
              maxDiscountPercentage: item.maxDiscountPercentage
                ? Number(item.maxDiscountPercentage)
                : 0,
              gstRate: parseFloat(item.gstRate || 0),
              subtexts: item.subtexts || [],
              originalItem: item.originalItem || item,
            })),
            totalQuantity: Number(fetchedQuotation.totalQuantity),
            totalAmount: Number(fetchedQuotation.totalAmount),
            gstAmount: Number(fetchedQuotation.gstAmount),
            grandTotal: Number(fetchedQuotation.grandTotal),
            billingAddress:
              fetchedQuotation.billingAddress ||
              getInitialQuotationData(user?.id).billingAddress,
            status: fetchedQuotation.status || "open",
            client: {
              companyName: fetchedQuotation.client?.companyName || "",
              gstNumber: fetchedQuotation.client?.gstNumber || "",
              clientName: fetchedQuotation.client?.clientName || "",
              email: fetchedQuotation.client?.email || "",
              phone: fetchedQuotation.client?.phone || "",
              _id: fetchedQuotation.client?._id || null,
            },
          });
          setSelectedClientIdForForm(fetchedQuotation.client?._id || null);
        } catch (err) {
          handleApiError(
            err,
            "Failed to fetch quotation for editing.",
            user,
            "quotationFormActivity"
          );
          navigate("/quotations");
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuotation();
    } else if (!isEditing) { // If creating a new quotation
      const fetchDefaults = async () => {
        setIsLoading(true);
        try {
          const defaults = await apiClient('/quotations/defaults');
          setQuotationData(prev => ({
            ...prev,
            referenceNumber: defaults.nextQuotationNumber,
            validityDate: defaults.defaultValidityDate,
            dispatchDays: defaults.defaultDispatchDays,
            termsAndConditions: defaults.defaultTermsAndConditions,
            orderIssuedBy: user?.id || "", // Set the current user as orderIssuedBy
          }));
        } catch (err) {
          handleApiError(err, "Failed to fetch quotation defaults. Using fallback values.", user, "quotationFormActivity");
          // Fallback to client-side defaults if API fails
          setQuotationData(prev => ({
            ...prev,
            validityDate: formatDateForInput(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
            orderIssuedBy: user?.id || "",
          }));
        } finally {
          setIsLoading(false);
        }
      };
      fetchDefaults();
    }
  }, [quotationIdFromParams, isEditing, location.state, navigate, user, getInitialQuotationData]);

  const handleAddItem = useCallback(
    (item) => {
      setQuotationData((prevQuotationData) => {
        const defaultUnit = item.units?.find(u => u.isBaseUnit)?.name || item.units?.[0]?.name || "nos";
        const pricePerSelectedUnit = typeof item.sellingPrice === "number" ? item.sellingPrice : 0;

        const newGoods = [
          ...prevQuotationData.goods,
          {
            srNo: prevQuotationData.goods.length + 1,
            description: item.name,
            hsnCode: item.hsnCode || "", // Use hsnCode
            quantity: 1,
            unit: defaultUnit,
            price: pricePerSelectedUnit,
            amount: pricePerSelectedUnit,
            originalPrice: pricePerSelectedUnit,
            sellingPrice: pricePerSelectedUnit,
            maxDiscountPercentage: parseFloat(item.maxDiscountPercentage) || 0,
            gstRate: parseFloat(item.gstRate || 0),
            subtexts: [],
            originalItem: item._id || item,
          },
        ];
        const totals = recalculateTotals(newGoods);
        return { ...prevQuotationData, goods: newGoods, ...totals };
      });
      setError(null);
    },
    [recalculateTotals]
  );

  const handleSaveAndAddNewItemToQuotation = useCallback(async (newItemData) => {
    if (!newItemData.name || !newItemData.pricing.sellingPrice || !newItemData.pricing.baseUnit) {
      toast.error("New item name, selling price, and base unit are required.");
      return;
    }
    setIsSavingNewItem(true);
    setError(null);

    try {
      const { pricing, ...restOfItemData } = newItemData;
      const payload = {
        ...restOfItemData,
        ...pricing,
      };
      const savedItem = await apiClient("/items", {
        method: "POST",
        body: payload,
      });
      toast.success(`Item "${savedItem.name}" created and added to quotation.`);
      handleAddItem(savedItem);
      setNewItemFormData(initialNewItemFormData);
      setItemCreationMode("search");
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to save new item.",
        user,
        "itemCreationInQuotation"
      );
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSavingNewItem(false);
    }
  }, [handleAddItem, user]);

  const handleGoodsChange = useCallback(
    (index, field, value, subtextIndex = null) => {
      setQuotationData((prevData) => {
        const updatedGoods = [...prevData.goods];
        let itemToUpdate = { ...updatedGoods[index] };
        let priceValidationError = null;

        if (field === "subtexts" && subtextIndex !== null) {
          if (!itemToUpdate.subtexts) itemToUpdate.subtexts = [];
          itemToUpdate.subtexts[subtextIndex] = value;
        } else if (field === "gstRate") {
          itemToUpdate[field] = value === "" ? null : parseFloat(value);
        } else {
          itemToUpdate[field] = (["quantity", "price"].includes(field)) ? Number(value) : value;
        }

        if (field === "quantity" || field === "unit") {
          const currentQuantity = Number(itemToUpdate.quantity) || 0;
          const selectedUnit = itemToUpdate.unit;
          const originalItem = itemToUpdate.originalItem;

          if (originalItem && selectedUnit) {
            const { pricePerSelectedUnit } = calculateItemPriceAndQuantity(originalItem, 1, selectedUnit);
            itemToUpdate.price = pricePerSelectedUnit;
            itemToUpdate.amount = pricePerSelectedUnit * currentQuantity;
          } else {
            itemToUpdate.amount = (currentQuantity || 0) * (itemToUpdate.price || 0);
          }
        } else if (field === "price") {
          itemToUpdate.amount = (Number(itemToUpdate.quantity) || 0) * (Number(itemToUpdate.price) || 0);
        }

        if (field === "price") {
          const currentItem = itemToUpdate;
          const newPrice = parseFloat(value);
          const originalPrice = parseFloat(currentItem.originalItem?.pricing?.sellingPrice);
          const maxDiscountPerc = parseFloat(currentItem.maxDiscountPercentage);

          if (!isNaN(newPrice) && !isNaN(originalPrice)) {
            const selectedUnitInfo = currentItem.originalItem?.units.find(u => u.name === currentItem.unit);
            const conversionFactor = selectedUnitInfo ? parseFloat(selectedUnitInfo.conversionFactor) : 1;
            const minAllowedPricePerSelectedUnit = (originalPrice * (1 - maxDiscountPerc / 100)) * conversionFactor;

            if (!isNaN(maxDiscountPerc) && maxDiscountPerc > 0) {
              if (newPrice < minAllowedPricePerSelectedUnit)
                priceValidationError = `Discount for ${currentItem.description} exceeds ${maxDiscountPerc}%. Min price for ${currentItem.unit} is ₹${minAllowedPricePerSelectedUnit.toFixed(2)}.`;
            }
          } else if (String(value).trim() !== "" && isNaN(newPrice)) {
            priceValidationError = `Invalid price for ${currentItem.description}.`;
          }
        }

        updatedGoods[index] = itemToUpdate;
        const totals = recalculateTotals(updatedGoods);

        if (priceValidationError) {
          setError(priceValidationError);
          toast.warn(priceValidationError);
        } else if (
          error &&
          (error.includes(`Discount for ${updatedGoods[index].description}`) ||
            error.includes(`Price for ${updatedGoods[index].description}`))
        ) {
          setError(null);
        }
        return { ...prevData, goods: updatedGoods, ...totals };
      });
    },
    [recalculateTotals, error]
  );

  const handleDeleteItem = useCallback(
    (indexToDelete) => {
      setQuotationData((prevData) => {
        const updatedGoods = prevData.goods
          .filter((_, index) => index !== indexToDelete)
          .map((item, index) => ({ ...item, srNo: index + 1 }));
        const totals = recalculateTotals(updatedGoods);
        return { ...prevData, goods: updatedGoods, ...totals };
      });
    },
    [recalculateTotals]
  );

  const handleAddSubtext = useCallback((itemIndex) => {
    setQuotationData((prevData) => {
      const updatedGoods = [...prevData.goods];
      if (!updatedGoods[itemIndex].subtexts)
        updatedGoods[itemIndex].subtexts = [];
      updatedGoods[itemIndex].subtexts.push("");
      return { ...prevData, goods: updatedGoods };
    });
  }, []);

  const handleDeleteSubtext = useCallback((itemIndex, subtextIndexToDelete) => {
    setQuotationData((prevData) => {
      const updatedGoods = [...prevData.goods];
      updatedGoods[itemIndex].subtexts.splice(subtextIndexToDelete, 1);
      return { ...prevData, goods: updatedGoods };
    });
  }, []);

  const fetchBillingAddressFromPincode = useCallback(
    async (pincode) => {
      if (!pincode || pincode.length !== 6) return;
      setIsFetchingBillingAddress(true);
      setError(null);
      try {
        const response = await fetch(
          `https://api.postalpincode.in/pincode/${pincode}`
        );
        const responseData = await response.json();
        if (
          responseData &&
          responseData.length > 0 &&
          responseData[0].Status === "Success"
        ) {
          const postOffice = responseData[0].PostOffice[0];
          if (postOffice) {
            setQuotationData((prev) => ({
              ...prev,
              billingAddress: {
                ...prev.billingAddress,
                city: postOffice.District || prev.billingAddress.city,
                state: postOffice.State || prev.billingAddress.state,
              },
            }));
            toast.success(`City and State auto-filled for pincode ${pincode}.`);
          } else {
            toast.warn(`No Post Office details found for pincode ${pincode}.`);
          }
        } else {
          toast.warn(
            `Could not find address details for pincode ${pincode}. Status: ${responseData[0]?.Status}`
          );
        }
      } catch (error) {
        console.error("Error fetching billing address:", error);
        toast.error("Error fetching address details.");
      } finally {
        setIsFetchingBillingAddress(false);
      }
    },
    []
  );

  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setQuotationData((prev) => {
        let newClientData = { ...prev.client };
        let newBillingAddress = { ...prev.billingAddress };
        let otherChanges = {};

        if (name.startsWith("client.")) {
          const clientField = name.split(".")[1];
          let processedValue = value;
          if (clientField === "gstNumber") processedValue = value.toUpperCase();
          else if (clientField === "email")
            processedValue = value.toLowerCase();
          newClientData = { ...newClientData, [clientField]: processedValue };
        } else if (name.startsWith("billingAddress.")) {
          const addressField = name.split(".")[1];
          newBillingAddress = { ...newBillingAddress, [addressField]: value };
          if (addressField === "pincode" && value.length === 6) {
            fetchBillingAddressFromPincode(value);
          }
        } else {
          otherChanges = { [name]: value };
        }
        return {
          ...prev,
          client: newClientData,
          billingAddress: newBillingAddress,
          ...otherChanges,
        };
      });
    },
    [fetchBillingAddressFromPincode]
  );

  const handleClientSelect = useCallback(
    (client) => {
      setQuotationData((prev) => ({
        ...prev,
        client: {
          _id: client._id,
          companyName: client.companyName || "",
          clientName: client.clientName || "",
          gstNumber: client.gstNumber || "",
          email: client.email || "",
          phone: client.phone || "",
        },
      }));
      setSelectedClientIdForForm(client._id);
      setError(null);
    },
    []
  );

  const handleSaveClientDetails = useCallback(async () => {
    const {
      companyName: rawCompanyName,
      gstNumber: rawGstNumber,
      email: rawEmail,
      phone: rawPhone,
    } = quotationData.client;
    const companyName = rawCompanyName?.trim();
    const gstNumber = rawGstNumber?.trim();
    const email = rawEmail?.trim();
    const phone = rawPhone?.trim();
    const clientName = quotationData.client.clientName?.trim();
    if (!companyName || !gstNumber || !email || !phone || !clientName) {
      const msg =
        "All client fields (Company Name, Client Name, GST Number, Email, Phone) are required.";
      setError(msg);
      toast.warn(msg);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const msg = "Invalid email format.";
      setError(msg);
      toast.warn(msg);
      return;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      const msg = "Phone number must be 10 digits.";
      setError(msg);
      toast.warn(msg);
      return;
    }
    setIsSavingClient(true);
    setError(null);
    const clientPayload = {
      companyName,
      gstNumber: gstNumber.toUpperCase(),
      clientName,
      phone,
      email,
    };
    try {
      const responseData = await apiClient("/clients", {
        method: "POST",
        body: clientPayload,
      });
      if (responseData && responseData._id) {
        setQuotationData((prev) => ({ ...prev, client: { ...responseData } }));
        setSelectedClientIdForForm(responseData._id);
        setError(null);
        toast.success("Client saved successfully!");
      } else {
        setError("Failed to save client: Unexpected response.");
        toast.error("Failed to save client: Unexpected response.");
      }
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to save client details.",
        user,
        "clientActivity"
      );
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSavingClient(false);
    }
  }, [quotationData.client, user]);

  const handleReplicationSelect = useCallback(
    async (selectedQuotationStub) => {
      if (!selectedQuotationStub || !selectedQuotationStub._id) {
        toast.error("Invalid quotation selected for replication.");
        return;
      }
      setIsLoadingReplicationDetails(true);
      setError(null);
      try {
        const fullQuotation = await apiClient(
          `/quotations/${selectedQuotationStub._id}`
        );
        if (!fullQuotation || !fullQuotation.client || !fullQuotation.goods) {
          throw new Error("Incomplete quotation data for replication.");
        }
        const replicatedGoods = fullQuotation.goods.map((item, index) => ({
          description: item.description,
          hsnCode: item.hsnCode || "",
          quantity: Number(item.quantity || 1),
          unit: item.unit || "nos",
          price: Number(item.price || 0),
          amount: Number(item.quantity || 1) * Number(item.price || 0),
          originalPrice: Number(item.originalPrice || item.price),
          maxDiscountPercentage: item.maxDiscountPercentage
            ? Number(item.maxDiscountPercentage)
            : 0,
          srNo: index + 1,
          gstRate: parseFloat(item.gstRate || 0),
          subtexts: item.subtexts || [],
          originalItem: item.originalItem || item,
        }));
        const totals = recalculateTotals(replicatedGoods);
        setQuotationData((prevData) => ({
          ...prevData,
          client: {
            _id: fullQuotation.client._id,
            companyName: fullQuotation.client.companyName || "",
            gstNumber: fullQuotation.client.gstNumber || "",
            clientName: fullQuotation.client.clientName || "",
            email: fullQuotation.client.email || "",
            phone: fullQuotation.client.phone || "",
          },
          billingAddress:
            fullQuotation.billingAddress ||
            getInitialQuotationData(user?.id).billingAddress,
          goods: replicatedGoods,
          ...totals,
          referenceNumber: "",
          date: formatDateForInput(new Date()),
        }));
        setSelectedClientIdForForm(fullQuotation.client._id);
        setIsReplicating(false);
        toast.info("Quotation data replicated. Review and save as new.");
      } catch (err) {
        const errorMessage = handleApiError(
          err,
          "Failed to load quotation details for replication."
        );
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoadingReplicationDetails(false);
      }
    },
    [recalculateTotals, user, getInitialQuotationData]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormValidated(true);
      const form = event.currentTarget;
      if (form.checkValidity() === false) {
        event.stopPropagation();
        setError("Please fill in all required fields.");
        toast.error("Please fill in all required fields.");
        return;
      }
      if (!quotationData.client._id) {
        if (
          quotationData.client.companyName ||
          quotationData.client.gstNumber ||
          quotationData.client.email ||
          quotationData.client.phone
        ) {
          setError("Save new client details first.");
          toast.warn("Save new client details first.");
        } else {
          setError("Select or save client details.");
          toast.warn("Select or save client details.");
        }
        return;
      }
      if (!quotationData.goods || quotationData.goods.length === 0) {
        setError("Add at least one item.");
        toast.error("Add at least one item.");
        return;
      }
      for (let i = 0; i < quotationData.goods.length; i++) {
        const item = quotationData.goods[i]; // This is the item from the quotation's goods array
        if (
          !item.description ||
          !(parseFloat(item.quantity) > 0) ||
          !(parseFloat(item.price) >= 0) ||
          !item.unit
        ) {
          const itemErrorMsg = `Item ${i + 1} incomplete.`;
          setError(itemErrorMsg);
          toast.error(itemErrorMsg);
          return;
        }
        if (item.maxDiscountPercentage > 0) {
          const selectedUnitInfo = item.originalItem?.units?.find(u => u.name === item.unit); // Added optional chaining for .units
          const conversionFactor = selectedUnitInfo ? parseFloat(selectedUnitInfo.conversionFactor) : 1;
          const originalBasePrice = parseFloat(item.originalItem?.pricing?.sellingPrice || item.originalPrice);
          const minAllowedPrice = (originalBasePrice * (1 - (item.maxDiscountPercentage || 0) / 100)) * conversionFactor;

          if (parseFloat(item.price) < minAllowedPrice) {
            const priceErrorMsg = `Warning: Price for ${item.description} (₹${parseFloat(item.price).toFixed(2)}) is below minimum (₹${minAllowedPrice.toFixed(2)}) due to discount limit of ${item.maxDiscountPercentage}%.`;
            setError(priceErrorMsg);
            toast.warn(priceErrorMsg);
          }
        }
      }
      setIsLoading(true);
      setError(null);
      const submissionData = {
        referenceNumber: quotationData.referenceNumber,
        date: new Date(quotationData.date).toISOString(),
        validityDate: new Date(quotationData.validityDate).toISOString(),
        orderIssuedBy: quotationData.orderIssuedBy,
        goods: quotationData.goods.map((item) => ({
          srNo: item.srNo,
          description: item.description,
          hsnCode: item.hsnCode || item.hsnCode || "",
          quantity: Number(item.quantity),
          unit: item.unit || "nos",
          price: Number(item.price),
          amount: Number(item.amount),
          sellingPrice: Number(item.sellingPrice),
          originalItem: item.originalItem?._id || item.originalItem,
          maxDiscountPercentage: item.maxDiscountPercentage
            ? Number(item.maxDiscountPercentage)
            : 0,
          gstRate: item.gstRate === null ? 0 : parseFloat(item.gstRate || 0),
          subtexts: item.subtexts || [],
        })),
        totalQuantity: Number(quotationData.totalQuantity),
        totalAmount: Number(quotationData.totalAmount),
        gstAmount: Number(quotationData.gstAmount),
        grandTotal: Number(quotationData.grandTotal),
        roundOffTotal: Number(quotationData.roundOffTotal), // <-- Add this
        status: quotationData.status || "open",
        client: quotationData.client,
        billingAddress: quotationData.billingAddress,
      };
      try {
        const url =
          isEditing && quotationIdFromParams
            ? `/quotations/${quotationIdFromParams}`
            : "/quotations";
        const method = isEditing && quotationIdFromParams ? "put" : "post";
        const responseData = await apiClient(url, {
          method,
          body: submissionData,
        });
        if (responseData) {
          toast.success(
            `Quotation ${submissionData.referenceNumber} ${
              isEditing ? "updated" : "created"
            }!`
          );
          navigate("/quotations");
        }
      } catch (error) {
        const errorMessage = handleApiError(
          error,
          "Failed to save quotation.",
          user,
          "quotationActivity"
        );
        if (error.status === 401) {
          navigate("/login", {
            state: {
              from: `/quotations/form${
                quotationIdFromParams ? `/${quotationIdFromParams}` : ""
              }`,
            },
          });
          return;
        }
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [quotationData, isEditing, quotationIdFromParams, user, navigate]
  );

  const pageTitle = isEditing
    ? `Edit Quotation - ${quotationData.referenceNumber}`
    : `Create New Quotation - ${quotationData.referenceNumber}`;
  const pageFooter = (
    <>
      <Button
        variant="secondary"
        onClick={() => navigate("/quotations")}
        disabled={isLoading || isLoadingReplicationDetails}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        form={quotationFormId}
        disabled={isLoading || isLoadingReplicationDetails}
      >
        {isLoading || isLoadingReplicationDetails
          ? isEditing
            ? "Updating..."
            : "Saving..."
          : isEditing
          ? "Update Quotation"
          : "Save Quotation"}
      </Button>
    </>
  );

  if (
    authLoading ||
    (isEditing && isLoading && !quotationData.referenceNumber)
  ) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" /> Loading form...
      </div>
    );
  }

  return (
    <ReusablePageStructure
      showBackButton={true}
      title={pageTitle}
      footerContent={pageFooter}
    >
      <Form
        id={quotationFormId}
        noValidate
        validated={formValidated}
        onSubmit={handleSubmit}
      >
        {!isEditing && (
          <>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Replicate Existing Quotation?"
                checked={isReplicating}
                onChange={(e) => setIsReplicating(e.target.checked)}
              />
            </Form.Group>
            {isReplicating && !isLoadingReplicationDetails && (
              <QuotationSearchComponent
                onQuotationSelect={handleReplicationSelect}
                placeholder="Search quotation to replicate..."
              />
            )}
            {
              isReplicating && !isLoadingReplicationDetails && (
                <div style={{ minHeight: "200px" }}></div>
              )
            }
            {isLoadingReplicationDetails && (
              <div className="text-center my-3">
                <Spinner animation="border" />{" "}
                <p>Loading quotation details...</p>
              </div>
            )}
          </>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="row">
          <Form.Group className="mb-3 col-md-4">
            <Form.Label>
              Issue Date <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="date"
              name="date"
              value={quotationData.date}
              onChange={handleInputChange}
              disabled={isLoadingReplicationDetails}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-md-4">
            <Form.Label>
              Validity Date <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="date"
              name="validityDate"
              value={quotationData.validityDate}
              onChange={handleInputChange}
              disabled={isLoadingReplicationDetails}
            />
          </Form.Group>
          {new Date(quotationData.validityDate) <
            new Date(quotationData.date) && (
            <Alert variant="warning" className="mt-0 mb-2 p-2 small">
              Warning: Validity date is before issue date.
            </Alert>
          )}
          <Form.Group className="mb-3 col-md-4">
            <Form.Label>
              Status <span className="text-danger">*</span>
            </Form.Label>
            {isEditing &&
            (quotationData.status === "running" ||
              quotationData.status === "closed") ? (
              <Form.Control
                type="text"
                value={
                  quotationData.status.charAt(0).toUpperCase() +
                  quotationData.status.slice(1)
                }
                readOnly
                disabled={isLoadingReplicationDetails}
              />
            ) : (
              <Form.Select
                required
                name="status"
                value={quotationData.status}
                onChange={handleInputChange}
                disabled={isLoadingReplicationDetails}
              >
                <option value="open">Open</option>
                <option value="hold">Hold</option>
              </Form.Select>
            )}
          </Form.Group>
        </div>
        <h5
          style={{
            fontWeight: "bold",
            textAlign: "center",
            backgroundColor: "#f0f2f5",
            padding: "0.5rem",
            borderRadius: "0.25rem",
            marginBottom: "1rem",
          }}
        >
          Client Details
        </h5>
        <div className="row mb-3">
          <div className="col-12">
            <ClientSearchComponent
              onClientSelect={handleClientSelect}
              placeholder="Search & select client"
              currentClientId={selectedClientIdForForm}
              disabled={isLoadingReplicationDetails}
            />
          </div>
        </div>
        <div className="row">
          <Form.Group className="mb-3 col-md-6">
            <Form.Label>
              Company Name <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="text"
              name="client.companyName"
              value={quotationData.client.companyName}
              onChange={
                !selectedClientIdForForm ? handleInputChange : undefined
              }
              readOnly={!!selectedClientIdForForm}
              disabled={isLoadingReplicationDetails}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-md-6">
            <Form.Label>
              Client Name (Contact Person){" "}
              <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="text"
              name="client.clientName"
              value={quotationData.client.clientName || ""}
              onChange={
                !selectedClientIdForForm ? handleInputChange : undefined
              }
              readOnly={!!selectedClientIdForForm}
              disabled={isLoadingReplicationDetails}
              placeholder="Enter contact person's name"
            />
          </Form.Group>
        </div>
        <div className="row">
          <Form.Group className="mb-3 col-md-6">
            <Form.Label>
              GST Number <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="text"
              name="client.gstNumber"
              value={quotationData.client.gstNumber}
              onChange={
                !selectedClientIdForForm ? handleInputChange : undefined
              }
              readOnly={!!selectedClientIdForForm}
              disabled={isLoadingReplicationDetails}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-md-6">
            <Form.Label>
              Email <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="email"
              name="client.email"
              value={quotationData.client.email}
              onChange={
                !selectedClientIdForForm ? handleInputChange : undefined
              }
              readOnly={!!selectedClientIdForForm}
              disabled={isLoadingReplicationDetails}
            />
          </Form.Group>
        </div>
        <div className="row mb-3 align-items-end">
          <Form.Group className="mb-3 col-md-6">
            <Form.Label>
              Phone <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="tel"
              name="client.phone"
              value={quotationData.client.phone}
              onChange={
                !selectedClientIdForForm ? handleInputChange : undefined
              }
              readOnly={!!selectedClientIdForForm}
              disabled={isLoadingReplicationDetails}
            />
          </Form.Group>
          <div className="col-md-6 d-flex gap-2 justify-content-start justify-content-md-end align-items-center mb-3 flex-wrap">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                setSelectedClientIdForForm(null);
                setQuotationData((prev) => ({
                  ...prev,
                  client: { ...getInitialQuotationData().client, _id: null },
                }));
              }}
              disabled={isLoadingReplicationDetails || !selectedClientIdForForm}
            >
              Clear/Edit Client
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleSaveClientDetails}
              disabled={
                isSavingClient ||
                isLoadingReplicationDetails ||
                !!selectedClientIdForForm ||
                !(
                  quotationData.client.companyName &&
                  quotationData.client.gstNumber &&
                  quotationData.client.clientName &&
                  quotationData.client.phone
                )
              }
            >
              {isSavingClient ? "Saving..." : "Save New Client"}
            </Button>
          </div>
        </div>
        <h5
          style={{
            fontWeight: "bold",
            textAlign: "center",
            backgroundColor: "#f0f2f5",
            padding: "0.5rem",
            borderRadius: "0.25rem",
            marginBottom: "1rem",
          }}
        >
          Billing Address
        </h5>
        <div className="row">
          <Form.Group className="mb-3 col-md-6">
            <Form.Label>
              Address Line 1 <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="text"
              name="billingAddress.address1"
              value={quotationData.billingAddress.address1}
              onChange={handleInputChange}
              disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-md-6">
            <Form.Label>Address Line 2</Form.Label>
            <Form.Control
              type="text"
              name="billingAddress.address2"
              value={quotationData.billingAddress.address2}
              onChange={handleInputChange}
              disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
            />
          </Form.Group>
        </div>
        <div className="row">
          <Form.Group className="mb-3 col-md-4">
            <Form.Label>
              Pincode <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="text"
              name="billingAddress.pincode"
              value={quotationData.billingAddress.pincode}
              pattern="[0-9]{6}"
              onChange={handleInputChange}
              disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
            />
            <Form.Text className="text-muted">
              6-digit pincode for City & State.
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3 col-md-4">
            <Form.Label>
              City <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="text"
              name="billingAddress.city"
              value={quotationData.billingAddress.city}
              onChange={handleInputChange}
              disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
              readOnly={
                !(isLoadingReplicationDetails || isFetchingBillingAddress) &&
                !!quotationData.billingAddress.city
              }
            />
          </Form.Group>
          <Form.Group className="mb-3 col-md-4">
            <Form.Label>
              State <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              type="text"
              name="billingAddress.state"
              value={quotationData.billingAddress.state}
              onChange={handleInputChange}
              disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
              readOnly={
                !(isLoadingReplicationDetails || isFetchingBillingAddress) &&
                !!quotationData.billingAddress.state
              }
            />
          </Form.Group>
        </div>
        <h5
          style={{
            fontWeight: "bold",
            textAlign: "center",
            backgroundColor: "#f0f2f5",
            padding: "0.5rem",
            borderRadius: "0.25rem",
            marginBottom: "1rem",
          }}
        >
          Goods Details
        </h5>
        <GoodsTable
          goods={quotationData.goods}
          handleGoodsChange={handleGoodsChange}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onAddSubtext={handleAddSubtext}
          onDeleteSubtext={handleDeleteSubtext}
          onItemSearchDropdownToggle={setIsItemSearchDropdownOpenInModal}
          itemCreationMode={itemCreationMode}
          setItemCreationMode={setItemCreationMode}
          newItemFormData={newItemFormData}
          setNewItemFormData={setNewItemFormData}
          handleSaveAndAddNewItemToQuotation={
            handleSaveAndAddNewItemToQuotation
          }
          isSavingNewItem={isSavingNewItem}
        />
        {isItemSearchDropdownOpenInModal && (
          <div style={{ height: "300px" }}></div>
        )}
        <div className="bg-light p-3 rounded mt-3">
          <h5 className="text-center mb-3">Quotation Summary</h5>
          <Table bordered size="sm">
            <tbody>
              <tr>
                <td>Total Quantity</td>
                <td className="text-end">
                  <strong>{quotationData.totalQuantity}</strong>
                </td>
              </tr>
              <tr>
                <td>Total Amount (Subtotal)</td>
                <td className="text-end">
                  <strong>₹{quotationData.totalAmount.toFixed(2)}</strong>
                </td>
              </tr>
              <tr>
                <td>Total GST</td>
                <td className="text-end">
                  <strong>₹{quotationData.gstAmount.toFixed(2)}</strong>
                </td>
              </tr>
              <tr>
                <td>Grand Total</td>
                <td className="text-end">
                  <strong>₹{quotationData.grandTotal.toFixed(2)}</strong>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                  Round Off Total <span className="text-danger">*</span>
                </td>
                <td
                  className="text-end"
                  style={{ fontWeight: "bold", fontSize: "1.1rem" }}
                >
                  <strong>₹{quotationData.roundOffTotal}</strong>
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
      </Form>
    </ReusablePageStructure>
  );
};

export default QuotationFormPage;
