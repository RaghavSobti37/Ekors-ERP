// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/minipages/quotations/QuotationFormPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button, Alert, Spinner, Table, Row, Col } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import ClientSearchComponent from "../../components/ClientSearchComponent.jsx";
import ItemSearchComponent from "../../components/ItemSearch.jsx";
import QuotationSearchComponent from "../../components/QuotationSearchComponent.jsx";
import apiClient from "../../utils/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { handleApiError, formatDateForInput, getReadOnlyFieldStyle } from "../../utils/helpers.js";
import { calculateItemPriceAndQuantity } from "../../utils/unitConversion.js";
import NewItemForm from "../../components/NewItemForm";
import { getInitialQuotationPayload, recalculateQuotationTotals, normalizeItemForQuotation } from "../../utils/payloads";

// Use the utility function for read-only fields
const readOnlyFieldStyle = getReadOnlyFieldStyle();

// Utility to generate a unique quotation number (customize as needed)
function generateQuotationNumber() {
  const now = new Date();
  return (
    "Q-" +
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0")
  );
}

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
  fieldErrors,
  categories = [],
  onAddCategory,
  newCategory,
  setNewCategory,
  isAddingCategory,
}) => {
  // Helper to get all units for an item (from item.units, originalItem.units, or fallback)
  const getAllUnits = (item) => {
    // Prefer item.units if present and non-empty
    if (item.units && Array.isArray(item.units) && item.units.length > 0) {
      return item.units;
    }
    // Try originalItem.units if available
    if (
      item.originalItem &&
      item.originalItem.units &&
      Array.isArray(item.originalItem.units) &&
      item.originalItem.units.length > 0
    ) {
      return item.originalItem.units;
    }
    // Fallback to base unit
    return [
      { name: item.unit || "nos", isBaseUnit: true, conversionFactor: 1 },
    ];
  };

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
          {goods.map((item, index) => {
            const allUnits = getAllUnits(item);
            return (
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
                    disabled={!!item.originalItem?.hsnCode} // Disable if it's from original item
                    isInvalid={!!fieldErrors[`goods.${index}.hsnCode`]}
                  />
                  <Form.Control.Feedback type="invalid">
                    {fieldErrors[`goods.${index}.hsnCode`]}
                  </Form.Control.Feedback>
                </td>
                <td>
                  <Form.Control
                    required
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) =>
                      handleGoodsChange(index, "quantity", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <Form.Select
                    value={item.unit || allUnits[0]?.name || "nos"}
                    onChange={(e) =>
                      handleGoodsChange(index, "unit", e.target.value)
                    }
                  >
                    {allUnits.map((unitOption) => (
                      <option key={unitOption.name} value={unitOption.name}>
                        {unitOption.name}
                      </option>
                    ))}
                  </Form.Select>
                </td>
                <td>
                  <Form.Control
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price || 0}
                    onChange={(e) =>
                      handleGoodsChange(index, "price", Number(e.target.value))
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
                      handleGoodsChange(index, "gstRate", Number(e.target.value))
                    }
                  />
                </td>
                <td className="align-middle">
                  ₹{(item.amount || 0).toFixed(2)}
                </td>
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
            );
          })}
        </tbody>
      </Table>
      <div className="mb-3">
        <div className="d-flex gap-2 mb-2 align-items-center">
          <Button
            variant={itemCreationMode === "new" ? "primary" : "outline-primary"}
            onClick={() => setItemCreationMode("new")}
            size="sm"
          >
            Create New Item
          </Button>
          <Button
            variant={itemCreationMode === "search" ? "primary" : "outline-primary"}
            onClick={() => setItemCreationMode("search")}
            size="sm"
          >
            Add Existing Item
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
            <div className="p-3 border rounded bg-light">
              <NewItemForm
                onSubmit={handleSaveAndAddNewItemToQuotation}
                isSaving={isSavingNewItem}
                error={fieldErrors?.form}
                success={fieldErrors?.success}
                categories={categories}
                onAddCategory={onAddCategory}
                newCategory={newCategory}
                setNewCategory={setNewCategory}
                isAddingCategory={isAddingCategory}
              />
            </div>
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

  // Use the shared payload for initial state
  const [quotationData, setQuotationData] = useState(() => {
    const initialData = location.state?.quotationDataForForm || getInitialQuotationPayload(user?.id);
    
    // Ensure shippingAddress is always initialized
    if (!initialData.shippingAddress) {
      initialData.shippingAddress = {
        address1: "",
        address2: "",
        city: "",
        state: "",
        pincode: ""
      };
    }
    
    return initialData;
  });
  const [isEditing, setIsEditing] = useState(
    !!quotationIdFromParams || !!location.state?.isEditing
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formValidated, setFormValidated] = useState(false);
  const [selectedClientIdForForm, setSelectedClientIdForForm] = useState(
    quotationData.client?._id || null
  );
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isFetchingBillingAddress, setIsFetchingBillingAddress] = useState(false);
  const [isFetchingShippingAddress, setIsFetchingShippingAddress] = useState(false);
  const [isItemSearchDropdownOpenInModal, setIsItemSearchDropdownOpenInModal] =
    useState(false);
  const [isReplicating, setIsReplicating] = useState(false);
  const [isLoadingReplicationDetails, setIsLoadingReplicationDetails] =
    useState(false);

  const [itemCreationMode, setItemCreationMode] = useState("search");
  const [newItemFormData, setNewItemFormData] = useState({
    name: "",
    pricing: {
      baseUnit: "nos",
      sellingPrice: "",
      buyingPrice: "",
    },
    units: [{ name: "nos", isBaseUnit: true, conversionFactor: 1 }],
    category: "",
    hsnCode: "",
    gstRate: "0",
    quantity: 0, // default to 0
    lowStockThreshold: "5",
  });
  const [isSavingNewItem, setIsSavingNewItem] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
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

          // Fetch units for each item from Item master
          const goodsWithUnits = await Promise.all(
            (fetchedQuotation.goods || []).map(async (item) => {
              let units = [];
              let originalItemDoc = item.originalItem || item;
              try {
                // Try to fetch the item from backend to get latest units
                const itemId = originalItemDoc._id || originalItemDoc;
                const itemDoc = await apiClient(`/items/${itemId}`);
                units = itemDoc.units || [];
                originalItemDoc = itemDoc;
              } catch {
                units = item.units || [];
              }
              return {
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
                originalItem: originalItemDoc,
                units,
              };
            })
          );

          // Use existing totals from the database if available, otherwise recalculate
          const recalculatedTotals = recalculateQuotationTotals(goodsWithUnits);
          
          // Log the retrieved values for debugging
          console.log("Fetched quotation totals:", {
            totalQuantity: fetchedQuotation.totalQuantity,
            totalAmount: fetchedQuotation.totalAmount,
            gstAmount: fetchedQuotation.gstAmount,
            grandTotal: fetchedQuotation.grandTotal,
            roundOffTotal: fetchedQuotation.roundOffTotal,
            roundingDifference: fetchedQuotation.roundingDifference,
            roundingDirection: fetchedQuotation.roundingDirection
          });

          setQuotationData({
            date: formatDateForInput(fetchedQuotation.date),
            referenceNumber: fetchedQuotation.referenceNumber,
            validityDate: formatDateForInput(fetchedQuotation.validityDate),
            orderIssuedBy:
              typeof orderIssuedByIdToSet === "object" &&
              orderIssuedByIdToSet !== null
                ? orderIssuedByIdToSet._id
                : orderIssuedByIdToSet,
            goods: goodsWithUnits,
            // Use the fetched values but fall back to recalculated values if necessary
            totalQuantity: fetchedQuotation.totalQuantity || recalculatedTotals.totalQuantity,
            totalAmount: fetchedQuotation.totalAmount || recalculatedTotals.totalAmount,
            gstAmount: fetchedQuotation.gstAmount || recalculatedTotals.gstAmount,
            grandTotal: fetchedQuotation.grandTotal || recalculatedTotals.grandTotal,
            roundOffTotal: fetchedQuotation.roundOffTotal || recalculatedTotals.roundOffTotal,
            roundingDifference: fetchedQuotation.roundingDifference || recalculatedTotals.roundingDifference,
            roundingDirection: fetchedQuotation.roundingDirection || recalculatedTotals.roundingDirection,
            billingAddress:
              fetchedQuotation.billingAddress ||
              getInitialQuotationPayload(user?.id).billingAddress,
            shippingAddress:
              fetchedQuotation.shippingAddress ||
              getInitialQuotationPayload(user?.id).shippingAddress,
            shippingSameAsBilling: fetchedQuotation.shippingSameAsBilling || false,
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
    } else if (location.state?.quotationDataForForm) {
      setQuotationData(location.state.quotationDataForForm);
      setSelectedClientIdForForm(
        location.state.quotationDataForForm.client?._id || null
      );
    }
    if (!isEditing && !location.state?.quotationDataForForm) {
      setQuotationData((prev) => ({ ...prev, orderIssuedBy: user?.id || "" }));
    }
  }, [
    quotationIdFromParams,
    isEditing,
    location.state,
    navigate,
    user,
    getInitialQuotationPayload,
  ]);

  const handleAddItem = useCallback(
    (item) => {
      setQuotationData((prev) => {
        const normalized = normalizeItemForQuotation(item);
        normalized.srNo = prev.goods.length + 1;
        
        // Ensure amount is properly calculated based on quantity and price
        const quantity = Number(normalized.quantity || 1);
        const price = Number(normalized.price || 0);
        normalized.quantity = quantity;
        normalized.price = price;
        normalized.amount = quantity * price;
        
        const newGoods = [...prev.goods, normalized];
        const totals = recalculateQuotationTotals(newGoods);
        return { ...prev, goods: newGoods, ...totals };
      });
      setError(null);
    },
    []
  );

  const handleSaveAndAddNewItemToQuotation = useCallback(
    async (newItemData) => {
      if (
        !newItemData.name ||
        !newItemData.pricing.sellingPrice ||
        !newItemData.pricing.baseUnit
      ) {
        toast.error(
          "New item name, selling price, and base unit are required."
        );
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
        toast.success(
          `Item "${savedItem.name}" created and added to quotation.`
        );
        handleAddItem(savedItem);
        setNewItemFormData(getInitialQuotationPayload().goods);
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
    },
    [handleAddItem, user]
  );

  // Use recalculateTotals everywhere for goods changes
  const handleGoodsChange = useCallback(
    (index, field, value, subtextIndex = null) => {
      setQuotationData((prevData) => {
        const goods = prevData.goods.map((item, idx) => {
          if (idx !== index) return item;
          
          if (field === "subtexts") {
            const subtexts = [...(item.subtexts || [])];
            subtexts[subtextIndex] = value;
            return { ...item, subtexts };
          }
          
          // Create the updated item with the new field value
          const updatedItem = { ...item, [field]: value };
          
          // Recalculate amount when quantity or price changes
          if (field === 'quantity' || field === 'price') {
            const quantity = Number(field === 'quantity' ? value : item.quantity || 0);
            const price = Number(field === 'price' ? value : item.price || 0);
            updatedItem.amount = quantity * price;
          }
          
          return updatedItem;
        });
        
        const totals = recalculateQuotationTotals(goods);
        
        // Log for debugging the rounding calculations
        console.log("Goods changed, recalculated totals:", {
          totalQuantity: totals.totalQuantity,
          totalAmount: totals.totalAmount,
          gstAmount: totals.gstAmount,
          grandTotal: totals.grandTotal,
          roundOffTotal: totals.roundOffTotal,
          roundingDifference: totals.roundingDifference,
          roundingDirection: totals.roundingDirection
        });
        
        return { ...prevData, goods, ...totals };
      });
    },
    []
  );

  const handleDeleteItem = useCallback(
    (indexToDelete) => {
      setQuotationData((prevData) => {
        const updatedGoods = prevData.goods
          .filter((_, index) => index !== indexToDelete)
          .map((item, idx) => ({
            ...item,
            srNo: idx + 1,
          }));
        return {
          ...prevData,
          goods: updatedGoods,
          ...recalculateQuotationTotals(updatedGoods),
        };
      });
    },
    []
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

  const fetchBillingAddressFromPincode = useCallback(async (pincode) => {
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
          setQuotationData((prev) => {
            const updatedBillingAddress = {
              ...prev.billingAddress,
              city: postOffice.District || prev.billingAddress.city,
              state: postOffice.State || prev.billingAddress.state,
            };
            
            // Update shipping address if same as billing
            let updatedShippingAddress = { ...prev.shippingAddress };
            if (prev.shippingSameAsBilling) {
              updatedShippingAddress = {
                ...updatedShippingAddress,
                city: updatedBillingAddress.city,
                state: updatedBillingAddress.state,
                pincode: pincode
              };
            }
            
            return {
              ...prev,
              billingAddress: updatedBillingAddress,
              shippingAddress: prev.shippingSameAsBilling ? updatedShippingAddress : prev.shippingAddress,
            };
          });
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
  }, []);
  
  const fetchShippingAddressFromPincode = useCallback(async (pincode) => {
    if (!pincode || pincode.length !== 6) return;
    setIsFetchingShippingAddress(true);
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
            shippingAddress: {
              ...prev.shippingAddress,
              city: postOffice.District || prev.shippingAddress.city,
              state: postOffice.State || prev.shippingAddress.state,
            },
          }));
          toast.success(`City and State auto-filled for shipping pincode ${pincode}.`);
        } else {
          toast.warn(`No Post Office details found for pincode ${pincode}.`);
        }
      } else {
        toast.warn(
          `Could not find address details for pincode ${pincode}. Status: ${responseData[0]?.Status}`
        );
      }
    } catch (error) {
      console.error("Error fetching shipping address:", error);
      toast.error("Error fetching address details.");
    } finally {
      setIsFetchingShippingAddress(false);
    }
  }, []);

  // Safe value accessor function to prevent 'undefined' errors
  const safeGet = (obj, path, defaultValue = "") => {
    if (!obj) return defaultValue;
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result === undefined || result === null ? defaultValue : result;
  };

  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setQuotationData((prev) => {
        let newClientData = { ...prev.client };
        let newBillingAddress = { ...prev.billingAddress };
        let newShippingAddress = { ...prev.shippingAddress };
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
          
          // If shipping same as billing, update shipping too
          if (prev.shippingSameAsBilling) {
            newShippingAddress = { ...newShippingAddress, [addressField]: value };
          }
          
          if (addressField === "pincode" && value.length === 6) {
            fetchBillingAddressFromPincode(value);
          }
        } else if (name.startsWith("shippingAddress.")) {
          const addressField = name.split(".")[1];
          newShippingAddress = { ...newShippingAddress, [addressField]: value };
          
          if (addressField === "pincode" && value.length === 6) {
            fetchShippingAddressFromPincode(value);
          }
        } else if (name === "shippingSameAsBilling") {
          // If toggling same as billing checkbox
          otherChanges = { shippingSameAsBilling: value === "true" || value === true };
          if (otherChanges.shippingSameAsBilling) {
            // Copy billing address to shipping address
            newShippingAddress = { ...newBillingAddress };
          }
        } else {
          otherChanges = { [name]: value };
        }
        
        return {
          ...prev,
          client: newClientData,
          billingAddress: newBillingAddress,
          shippingAddress: newShippingAddress,
          ...otherChanges,
        };
      });
    },
    [fetchBillingAddressFromPincode, fetchShippingAddressFromPincode]
  );

  const handleClientSelect = useCallback((client) => {
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
  }, []);

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
        const totals = recalculateQuotationTotals(replicatedGoods);
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
            getInitialQuotationPayload(user?.id).billingAddress,
          goods: replicatedGoods,
          ...totals,
          referenceNumber: generateQuotationNumber(),
          date: formatDateForInput(new Date()),
          // Store the original quotation ID to track that it was replicated
          replicatedFromQuotationId: selectedQuotationStub._id
        }));
        setSelectedClientIdForForm(fullQuotation.client._id);
        setIsReplicating(false); // Hide the replication UI
        toast.success("Quotation data replicated. Review and save as new.");
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
    [user, getInitialQuotationPayload]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormValidated(true);
      setFieldErrors({});
      let errors = {};

      if (!quotationData.client.companyName)
        errors["client.companyName"] = "Company Name is required";
      if (!quotationData.client.clientName)
        errors["client.clientName"] = "Client Name is required";
      if (!quotationData.client.gstNumber)
        errors["client.gstNumber"] = "GST Number is required";
      if (!quotationData.client.email)
        errors["client.email"] = "Email is required";
      if (!quotationData.client.phone)
        errors["client.phone"] = "Phone is required";
      if (!quotationData.billingAddress.address1)
        errors["billingAddress.address1"] = "Address Line 1 is required";
      if (!quotationData.billingAddress.pincode)
        errors["billingAddress.pincode"] = "Pincode is required";
      if (!quotationData.billingAddress.city)
        errors["billingAddress.city"] = "City is required";
      if (!quotationData.billingAddress.state)
        errors["billingAddress.state"] = "State is required";
      if (!quotationData.goods || quotationData.goods.length === 0)
        errors["goods"] = "Add at least one item.";

      quotationData.goods.forEach((item, i) => {
        if (!item.description)
          errors[`goods.${i}.description`] = `Description required for item ${
            i + 1
          }`;
        if (!item.hsnCode)
          errors[`goods.${i}.hsnCode`] = `HSN/SAC required for item ${i + 1}`;
        if (!(parseFloat(item.quantity) > 0))
          errors[`goods.${i}.quantity`] = `Quantity required for item ${i + 1}`;
        if (!(parseFloat(item.price) >= 0))
          errors[`goods.${i}.price`] = `Price required for item ${i + 1}`;
        if (!item.unit)
          errors[`goods.${i}.unit`] = `Unit required for item ${i + 1}`;
      });

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError("Please fix the highlighted errors.");
        toast.error("Please fix the highlighted errors.");
        return;
      }

      setIsLoading(true);
      setError(null);

      let clientId = quotationData.client._id;

      if (!clientId) {
        try {
          const clientPayload = {
            companyName: quotationData.client.companyName.trim(),
            gstNumber: quotationData.client.gstNumber.trim().toUpperCase(),
            clientName: quotationData.client.clientName.trim(),
            phone: quotationData.client.phone.trim(),
            email: quotationData.client.email.trim().toLowerCase(),
          };
          const responseData = await apiClient("/clients", {
            method: "POST",
            body: clientPayload,
          });
          if (responseData && responseData._id) {
            clientId = responseData._id;
          } else {
            setError("Failed to save client: Unexpected response.");
            setIsLoading(false);
            return;
          }
        } catch (error) {
          const errorMessage = handleApiError(
            error,
            "Failed to save client details.",
            user,
            "clientActivity"
          );
          setError(errorMessage);
          setIsLoading(false);
          return;
        }
      }

      // Process goods items to ensure all values are properly converted to numbers
      const goodsForSubmission = quotationData.goods.map((item) => {
        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        // Recalculate amount to ensure consistency
        const amount = quantity * price;
        
        return {
          srNo: item.srNo,
          description: item.description,
          hsnCode: item.hsnCode || "",
          quantity: quantity,
          unit: item.unit || "nos",
          price: price,
          amount: amount,
          sellingPrice: Number(item.sellingPrice || price),
          originalItem:
            typeof item.originalItem === "object"
              ? item.originalItem?._id
              : item.originalItem,
          maxDiscountPercentage: item.maxDiscountPercentage
            ? Number(item.maxDiscountPercentage)
            : 0,
          gstRate: item.gstRate === null ? 0 : parseFloat(item.gstRate || 0),
          subtexts: item.subtexts || [],
        };
      });

      // Recalculate totals from the processed goods to ensure consistency
      const recalculatedTotals = recalculateQuotationTotals(goodsForSubmission);
      
      // Log calculated values for debugging
      console.log("Recalculated totals for submission:", {
        totalQuantity: recalculatedTotals.totalQuantity,
        totalAmount: recalculatedTotals.totalAmount,
        gstAmount: recalculatedTotals.gstAmount,
        grandTotal: recalculatedTotals.grandTotal,
        roundOffTotal: recalculatedTotals.roundOffTotal,
        roundingDifference: recalculatedTotals.roundingDifference,
        roundingDirection: recalculatedTotals.roundingDirection
      });
      
      const submissionData = {
        referenceNumber: quotationData.referenceNumber,
        date: new Date(quotationData.date).toISOString(),
        validityDate: new Date(quotationData.validityDate).toISOString(),
        orderIssuedBy: quotationData.orderIssuedBy,
        goods: goodsForSubmission,
        billingAddress: quotationData.billingAddress,
        shippingAddress: quotationData.shippingSameAsBilling ? quotationData.billingAddress : quotationData.shippingAddress,
        shippingSameAsBilling: quotationData.shippingSameAsBilling || false,
        totalQuantity: recalculatedTotals.totalQuantity,
        totalAmount: recalculatedTotals.totalAmount,
        gstAmount: recalculatedTotals.gstAmount,
        grandTotal: recalculatedTotals.grandTotal,
        roundOffTotal: recalculatedTotals.roundOffTotal,
        roundingDifference: recalculatedTotals.roundingDifference,
        roundingDirection: recalculatedTotals.roundingDirection,
        status: quotationData.status || "open",
        client: { ...quotationData.client, _id: clientId },
        ...(quotationData.replicatedFromQuotationId && { 
          replicatedFromQuotationId: quotationData.replicatedFromQuotationId 
        }),
      };

      console.log("Submission data:", quotationData);

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

  useEffect(() => {
    // Fetch categories from backend or set static list
    async function fetchCategories() {
      try {
        const res = await apiClient("/items/categories/all");
        setCategories(res.data || []);
      } catch {
        setCategories([]);
      }
    }
    fetchCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    setIsAddingCategory(true);
    try {
      // Optionally, call backend to add category
      setCategories((prev) => [...prev, newCategory.trim()]);
      setNewCategory("");
    } finally {
      setIsAddingCategory(false);
    }
  };

  // Removed handleCreateTicket function as it's now handled through the original route

  useEffect(() => {
    if (isEditing && quotationIdFromParams && !location.state?.quotationDataForForm) {
      const fetchQuotation = async () => {
        setIsLoading(true);
        try {
          const fetchedQuotation = await apiClient(`/quotations/${quotationIdFromParams}`);
          setQuotationData((prev) => ({
            ...prev,
            ...fetchedQuotation,
            roundOffTotal: fetchedQuotation.roundOffTotal,
            roundingDifference: fetchedQuotation.roundingDifference,
            roundingDirection: fetchedQuotation.roundingDirection,
          }));
        } catch (err) {
          setError("Failed to fetch quotation data.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuotation();
    }
  }, [isEditing, quotationIdFromParams, location.state]);

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
        {!isEditing && !location.state?.quotationDataForForm && !quotationData.replicatedFromQuotationId && (
          <div className="bg-light p-4 mb-4 rounded text-center shadow-sm" style={{ backgroundColor: '#f0f2f5' }}>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label={
                  <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>
                    Replicate Existing Quotation?
                  </span>
                }
                checked={isReplicating}
                onChange={(e) => setIsReplicating(e.target.checked)}
                id="replicateCheckbox"
                className="d-inline-block"
              />
              {isReplicating && (
                <span className="ms-2 badge bg-success">
                  <i className="bi bi-check-circle-fill me-1"></i>
                  Replication Mode Active
                </span>
              )}
            </Form.Group>
            {isReplicating && !isLoadingReplicationDetails && (
              <div className="mx-auto" style={{ maxWidth: '600px' }}>
                <QuotationSearchComponent
                  onQuotationSelect={handleReplicationSelect}
                  placeholder="Search quotation to replicate..."
                />
                <div className="text-muted mt-2">
                  <small>Select a quotation to replicate its content with a new reference number</small>
                </div>
              </div>
            )}
            {isReplicating && !isLoadingReplicationDetails && (
              <div style={{ minHeight: "100px" }}></div>
            )}
            {isLoadingReplicationDetails && (
              <div className="text-center my-3">
                <Spinner animation="border" className="me-2" />
                <p className="mt-2">Loading quotation details...</p>
              </div>
            )}
          </div>
        )}
        {!isEditing && !location.state?.quotationDataForForm && quotationData.replicatedFromQuotationId && (
          <div className="alert alert-success text-center mb-4">
            <i className="bi bi-check-circle-fill me-2"></i>
            Quotation has been replicated successfully. Review and save as new.
          </div>
        )}
        {error && (
          <Alert variant="danger">
            {error}
            <ul>
              {Object.entries(fieldErrors).map(([field, msg]) => (
                <li key={field}>{msg}</li>
              ))}
            </ul>
          </Alert>
        )}
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
              isInvalid={!!fieldErrors["client.companyName"]}
              style={!!selectedClientIdForForm ? readOnlyFieldStyle : {}}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["client.companyName"]}
            </Form.Control.Feedback>
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
              isInvalid={!!fieldErrors["client.clientName"]}
              style={!!selectedClientIdForForm ? readOnlyFieldStyle : {}}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["client.clientName"]}
            </Form.Control.Feedback>
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
              isInvalid={!!fieldErrors["client.gstNumber"]}
              style={!!selectedClientIdForForm ? readOnlyFieldStyle : {}}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["client.gstNumber"]}
            </Form.Control.Feedback>
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
              isInvalid={!!fieldErrors["client.email"]}
              style={!!selectedClientIdForForm ? readOnlyFieldStyle : {}}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["client.email"]}
            </Form.Control.Feedback>
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
              isInvalid={!!fieldErrors["client.phone"]}
              style={!!selectedClientIdForForm ? readOnlyFieldStyle : {}}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["client.phone"]}
            </Form.Control.Feedback>
          </Form.Group>
          <div className="col-md-6 d-flex gap-2 justify-content-start justify-content-md-end align-items-center mb-3 flex-wrap">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                setSelectedClientIdForForm(null);
                setQuotationData((prev) => ({
                  ...prev,
                  client: { ...getInitialQuotationPayload().client, _id: null },
                }));
              }}
              disabled={isLoadingReplicationDetails || !selectedClientIdForForm}
            >
              Clear/Edit Client
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
              isInvalid={!!fieldErrors["billingAddress.address1"]}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["billingAddress.address1"]}
            </Form.Control.Feedback>
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
              isInvalid={!!fieldErrors["billingAddress.pincode"]}
            />
            <Form.Text className="text-muted">
              6-digit pincode for City & State.
            </Form.Text>
            <Form.Control.Feedback type="invalid">
              {fieldErrors["billingAddress.pincode"]}
            </Form.Control.Feedback>
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
              isInvalid={!!fieldErrors["billingAddress.city"]}
              style={!(isLoadingReplicationDetails || isFetchingBillingAddress) && 
                !!quotationData.billingAddress.city ? readOnlyFieldStyle : {}}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["billingAddress.city"]}
            </Form.Control.Feedback>
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
              isInvalid={!!fieldErrors["billingAddress.state"]}
              style={!(isLoadingReplicationDetails || isFetchingBillingAddress) && 
                !!quotationData.billingAddress.state ? readOnlyFieldStyle : {}}
            />
            <Form.Control.Feedback type="invalid">
              {fieldErrors["billingAddress.state"]}
            </Form.Control.Feedback>
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
          Shipping Address
        </h5>

        <div className="mb-3">
          <Form.Check
            type="checkbox"
            id="shippingSameAsBilling"
            name="shippingSameAsBilling"
            label="Same as Billing Address"
            checked={quotationData.shippingSameAsBilling || false}
            onChange={(e) => handleInputChange({ target: { name: 'shippingSameAsBilling', value: e.target.checked }})}
            disabled={isLoadingReplicationDetails}
          />
        </div>

        {!quotationData.shippingSameAsBilling && (
          <>
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Address Line 1</Form.Label>
                <Form.Control
                  type="text"
                  name="shippingAddress.address1"
                  value={safeGet(quotationData, 'shippingAddress.address1', '')}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingShippingAddress}
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Address Line 2</Form.Label>
                <Form.Control
                  type="text"
                  name="shippingAddress.address2"
                  value={safeGet(quotationData, 'shippingAddress.address2', '')}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingShippingAddress}
                />
              </Form.Group>
            </div>
            <div className="row">
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>Pincode</Form.Label>
                <Form.Control
                  type="text"
                  name="shippingAddress.pincode"
                  value={safeGet(quotationData, 'shippingAddress.pincode', '')}
                  pattern="[0-9]{6}"
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingShippingAddress}
                />
                <Form.Text className="text-muted">
                  6-digit pincode for City & State.
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>City</Form.Label>
                <Form.Control
                  type="text"
                  name="shippingAddress.city"
                  value={safeGet(quotationData, 'shippingAddress.city', '')}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingShippingAddress}
                  readOnly={
                    !(isLoadingReplicationDetails || isFetchingShippingAddress) &&
                    !!safeGet(quotationData, 'shippingAddress.city', '')
                  }
                  style={!(isLoadingReplicationDetails || isFetchingShippingAddress) && 
                    !!safeGet(quotationData, 'shippingAddress.city', '') ? readOnlyFieldStyle : {}}
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>State</Form.Label>
                <Form.Control
                  type="text"
                  name="shippingAddress.state"
                  value={quotationData.shippingAddress.state}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingShippingAddress}
                  readOnly={
                    !(isLoadingReplicationDetails || isFetchingShippingAddress) &&
                    !!quotationData.shippingAddress.state
                  }
                  style={!(isLoadingReplicationDetails || isFetchingShippingAddress) && 
                    !!quotationData.shippingAddress.state ? readOnlyFieldStyle : {}}
                />
              </Form.Group>
            </div>
          </>
        )}

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
          handleSaveAndAddNewItemToQuotation={handleSaveAndAddNewItemToQuotation}
          isSavingNewItem={isSavingNewItem}
          fieldErrors={fieldErrors}
          categories={categories}
          onAddCategory={handleAddCategory}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          isAddingCategory={isAddingCategory}
        />
        {isItemSearchDropdownOpenInModal && (
          <div style={{ height: "300px" }}></div>
        )}
        <div className="bg-light p-4 rounded mt-4 shadow-sm">
          <h5 className="text-center mb-4 border-bottom pb-2 fw-bold">Quotation Summary</h5>
          <Table bordered size="sm" className="table-hover"><tbody><tr>
                <td className="ps-3">Total Quantity</td>
                <td className="text-end pe-3">
                  <strong>{quotationData.totalQuantity}</strong>
                </td>
              </tr>
              <tr>
                <td className="ps-3">Total Amount (Subtotal)</td>
                <td className="text-end pe-3">
                  <strong>₹{quotationData.totalAmount?.toFixed(2) || '0.00'}</strong>
                </td>
              </tr>
              <tr>
                <td className="ps-3">Total GST</td>
                <td className="text-end pe-3">
                  <strong>₹{quotationData.gstAmount?.toFixed(2) || '0.00'}</strong>
                </td>
              </tr>
              <tr>
                <td className="ps-3">Grand Total (Exact)</td>
                <td className="text-end pe-3">
                  <strong>₹{quotationData.grandTotal?.toFixed(2) || '0.00'}</strong>
                </td>
              </tr>
              <tr>
                <td className="ps-3">
                  Rounding {quotationData.roundingDirection === 'up' ? 'Up' : 'Down'} 
                  <span className="text-muted ms-2" style={{fontSize: '0.85rem'}}>
                    ({quotationData.roundingDirection === 'up' ? '+' : '-'}₹{Math.abs(quotationData.roundingDifference || 0).toFixed(2)})
                  </span>
                </td>
                <td className="text-end pe-3">
                  <span className={quotationData.roundingDirection === 'up' ? 'text-success' : 'text-danger'}>
                    {quotationData.roundingDirection === 'up' ? '+' : '-'}₹{Math.abs(quotationData.roundingDifference || 0).toFixed(2)}
                  </span>
                </td>
              </tr>
              <tr className="table-success">
                <td className="ps-3" style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                  Round Off Total <span className="text-danger">*</span>
                </td>
                <td className="text-end pe-3" style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                  <div className="text-end fw-bold" style={{ fontSize: "1.1rem" }}>
                    ₹{quotationData.roundOffTotal?.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || "0"}
                  </div>
                </td>
              </tr></tbody></Table>
        </div>
      </Form>
    </ReusablePageStructure>
  );
};

export default QuotationFormPage;

// Example fix for controlled/uncontrolled warning:
// For all Form.Control components, ensure value is never undefined.
// For text inputs:
// value={item.description || ""}
// For number inputs:
// value={typeof item.quantity === "number" ? item.quantity : 0}
// For select inputs:
// value={item.unit || allUnits[0]?.name || "nos"}
// Apply this pattern to all Form.Control and Form.Select in the file.
