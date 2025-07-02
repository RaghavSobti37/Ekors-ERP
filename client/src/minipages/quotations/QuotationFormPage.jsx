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
import { handleApiError, formatDateForInput } from "../../utils/helpers.js";
import { calculateItemPriceAndQuantity } from "../../utils/unitConversion.js";
import NewItemForm from "../../components/NewItemForm";
import { getInitialQuotationPayload, recalculateQuotationTotals, normalizeItemForQuotation } from "../../utils/payloads";

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
                    min="1"
                    value={item.quantity || 1}
                    onChange={(e) =>
                      handleGoodsChange(index, "quantity", e.target.value)
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
  const [quotationData, setQuotationData] = useState(
    location.state?.quotationDataForForm || getInitialQuotationPayload(user?.id)
  );
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
  const [isFetchingBillingAddress, setIsFetchingBillingAddress] =
    useState(false);
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
    quantity: 1,
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
            totalQuantity: Number(fetchedQuotation.totalQuantity),
            totalAmount: Number(fetchedQuotation.totalAmount),
            gstAmount: Number(fetchedQuotation.gstAmount),
            grandTotal: Number(fetchedQuotation.grandTotal),
            billingAddress:
              fetchedQuotation.billingAddress ||
              getInitialQuotationPayload(user?.id).billingAddress,
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
        const newGoods = [...prev.goods, normalized];
        const totals = recalculateQuotationTotals(newGoods);
        return { ...prev, goods: newGoods, ...totals };
      });
      setError(null);
    },
    [recalculateQuotationTotals]
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
          return { ...item, [field]: value };
        });
        const totals = recalculateQuotationTotals(goods);
        return { ...prevData, goods, ...totals };
      });
    },
    [recalculateQuotationTotals]
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
    [recalculateQuotationTotals]
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
  }, []);

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
    [recalculateQuotationTotals, user, getInitialQuotationPayload]
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

      const goodsForSubmission = quotationData.goods.map((item) => ({
        srNo: item.srNo,
        description: item.description,
        hsnCode: item.hsnCode || "",
        quantity: Number(item.quantity),
        unit: item.unit || "nos",
        price: Number(item.price),
        amount: Number(item.amount),
        sellingPrice: Number(item.sellingPrice),
        originalItem:
          typeof item.originalItem === "object"
            ? item.originalItem?._id
            : item.originalItem,
        maxDiscountPercentage: item.maxDiscountPercentage
          ? Number(item.maxDiscountPercentage)
          : 0,
        gstRate: item.gstRate === null ? 0 : parseFloat(item.gstRate || 0),
        subtexts: item.subtexts || [],
      }));

      const submissionData = {
        referenceNumber: quotationData.referenceNumber,
        date: new Date(quotationData.date).toISOString(),
        validityDate: new Date(quotationData.validityDate).toISOString(),
        orderIssuedBy: quotationData.orderIssuedBy,
        goods: goodsForSubmission,
        billingAddress: quotationData.billingAddress,
        shippingAddress: quotationData.billingAddress,
        totalQuantity: Number(quotationData.totalQuantity),
        totalAmount: Number(quotationData.totalAmount),
        gstAmount: Number(quotationData.gstAmount),
        grandTotal: Number(quotationData.grandTotal),
        roundOffTotal: Number(quotationData.roundOffTotal),
        status: quotationData.status || "open",
        client: { ...quotationData.client, _id: clientId },
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
            {isReplicating && !isLoadingReplicationDetails && (
              <div style={{ minHeight: "200px" }}></div>
            )}
            {isLoadingReplicationDetails && (
              <div className="text-center my-3">
                <Spinner animation="border" />{" "}
                <p>Loading quotation details...</p>
              </div>
            )}
          </>
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
                  <Form.Control
                    type="number"
                    value={quotationData.roundOffTotal}
                    readOnly
                    plaintext
                    style={{
                      textAlign: "right",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                      border: "none",
                      backgroundColor: "transparent",
                    }}
                    tabIndex={-1}
                  />
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
