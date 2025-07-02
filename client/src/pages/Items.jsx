import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { Spinner, Button, Alert, Form } from "react-bootstrap";
import { PlusCircle, PencilSquare, Trash, Eye } from "react-bootstrap-icons";
import { useAuth } from "../context/AuthContext";
import Pagination from "../components/Pagination";
import ReusableTable from "../components/ReusableTable";
import Navbar from "../components/Navbar";
import SearchBar from "../components/Searchbar";
import SortIndicator from "../components/SortIndicator";
import ActionButtons from "../components/ActionButtons";

export default function Items() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDirection, setSortDirection] = useState("ascending");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch categories on mount
  useEffect(() => {
    apiClient("/items/categories")
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        status: "approved",
        search: searchTerm,
        sortKey: sortKey,
        sortDirection: sortDirection,
        // ...(selectedCategory && { category: selectedCategory }), // REMOVE category param
      };
      const res = await apiClient("/items", { params });
      setItems(res.data || []);
      setTotalItems(res.totalItems || 0);
    } catch (err) {
      setError("Failed to load items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, sortKey, sortDirection]); // REMOVE selectedCategory from deps

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
      fetchItems();
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    setLoading(true);
    try {
      await apiClient(`/items/${id}`, { method: "DELETE" });
      fetchItems();
    } catch {
      setError("Failed to delete item.");
    } finally {
      setLoading(false);
    }
  };

  // Table columns definition for ReusableTable
  const columns = [
    {
      key: "name",
      header: (
        <>
          Name
          <SortIndicator columnKey="name" sortConfig={{ key: sortKey, direction: sortDirection }} />
        </>
      ),
      sortable: true,
    },
    {
      key: "quantity",
      header: (
        <>
          Quantity
          <SortIndicator columnKey="quantity" sortConfig={{ key: sortKey, direction: sortDirection }} />
        </>
      ),
      renderCell: (item) =>
        `${parseFloat(item.quantity || 0).toFixed(2)} ${item.baseUnit}`,
      sortable: true,
    },
    {
      key: "sellingPrice",
      header: (
        <>
          Selling Price
          <SortIndicator columnKey="sellingPrice" sortConfig={{ key: sortKey, direction: sortDirection }} />
        </>
      ),
      renderCell: (item) => `₹${parseFloat(item.sellingPrice || 0).toFixed(2)}`,
      sortable: true,
    },
    {
      key: "buyingPrice",
      header: (
        <>
          Buying Price
          <SortIndicator columnKey="buyingPrice" sortConfig={{ key: sortKey, direction: sortDirection }} />
        </>
      ),
      renderCell: (item) => `₹${parseFloat(item.buyingPrice || 0).toFixed(2)}`,
      sortable: true,
    },
    // {
    //   key: "hsnCode",
    //   header: (
    //     <>
    //       HSN Code
    //       <SortIndicator columnKey="hsnCode" sortConfig={{ key: sortKey, direction: sortDirection }} />
    //     </>
    //   ),
    //   sortable: true,
    // },
    {
      key: "image",
      header: "Image",
      renderCell: (item) =>
        item.image ? (
          <img
            src={item.image}
            alt={item.name}
            style={{
              width: 40,
              height: 40,
              objectFit: "cover",
            }}
          />
        ) : (
          <span className="text-muted small">No Image</span>
        ),
    },
    {
      key: "category",
      header: (
        <>
          Category
          <SortIndicator columnKey="category" sortConfig={{ key: sortKey, direction: sortDirection }} />
        </>
      ),
      sortable: true,
    },
  ];

  // Replace renderActions with ActionButtons usage:
  const renderActions = (item) => (
    <ActionButtons
      item={item}
      onView={() => navigate(`/items/view/${item._id}`)}
      onEdit={() => navigate(`/items/edit/${item._id}`)}
      onDelete={() => handleDelete(item._id)}
      onGenerateReport={() => navigate(`/items/history/${item._id}`)}
      // You can add more handlers as needed
      size="sm"
    />
  );

  // Handle sorting
  const handleSort = (columnKey) => {
    if (sortKey === columnKey) {
      // Toggle direction if same column
      setSortDirection((prev) => (prev === "ascending" ? "descending" : "ascending"));
    } else {
      // New column, default to ascending
      setSortKey(columnKey);
      setSortDirection("ascending");
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await apiClient("/items/export-excel", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "items.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("Failed to export items.");
    } finally {
      setIsExporting(false);
    }
  };

  // Import from Excel
  const handleImportExcel = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsImporting(true);
      setError(null);
      setSuccess(null);
      try {
        const formData = new FormData();
        formData.append("excelFile", file);
        const res = await apiClient("/items/import-uploaded-excel", {
          method: "POST",
          body: formData,
        });
        // Show counts in the success message
        setSuccess(
          `Items imported successfully. Created: ${res.created}, Updated: ${res.updated}, Deleted: ${res.deleted}`
        );
        fetchItems();
      } catch (err) {
        if (err?.response?.data?.message) {
          setError(err.response.data.message);
        } else {
          setError("Failed to import items.");
        }
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  // You may have logic to fetch and display restock/low stock summary.
  // Only use restockNeededCount, keep lowStockWarningCount commented out.

  // Example (if you use this in your UI):
  // const [restockSummary, setRestockSummary] = useState({ restockNeededCount: 0 /*, lowStockWarningCount: 0 */ });

  // useEffect(() => {
  //   apiClient("/items/restock-summary")
  //     .then(res => setRestockSummary(res.data))
  //     .catch(() => setRestockSummary({ restockNeededCount: 0 /*, lowStockWarningCount: 0 */ }));
  // }, []);

  return (
    <div>
      <Navbar />
      <div className="container py-4 align-items-center">
        {/* Flex row for heading, searchbar, category dropdown, and add button */}
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
          <h2 className="mb-0 flex-shrink-0">Items List</h2>
          <div className="flex-grow-1 mx-3" style={{ minWidth: 250, maxWidth: 500 }}>
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onSearch={(term) => setSearchTerm(term)}
              placeholder="Search items by name, category, or code..."
              showButton={false}
            />
          </div>
          {/* <Form.Select
            className="flex-shrink-0"
            style={{ width: 180 }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat._id || cat} value={cat.name || cat}>
                {cat.name || cat}
              </option>
            ))}
          </Form.Select> */}
          <Button
            variant="success"
            className="flex-shrink-0"
            onClick={() => navigate("/items/add")}
          >
            <PlusCircle size={18} className="me-1" /> Add Item
          </Button>
        </div>
        {/* ...rest of your component... */}
        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}
        <ReusableTable
          columns={columns}
          data={items}
          keyField="_id"
          isLoading={loading}
          error={null}
          renderActions={renderActions}
          noDataMessage="No items found"
          tableClassName="table table-striped table-bordered"
          theadClassName="table-dark"
          onSort={handleSort}
          sortConfig={{ key: sortKey, direction: sortDirection }}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onExportExcel={handleExportExcel}
          onImportExcel={handleImportExcel}
          isExporting={isExporting}
          isImporting={isImporting}
        />
      </div>
    </div>
  );
}