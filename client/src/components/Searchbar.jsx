import React from "react";
import { Form, Button } from "react-bootstrap";

const SearchBar = ({ searchTerm, setSearchTerm, onAddNew, buttonText }) => {
  return (
    <div className="d-flex align-items-center gap-3" style={{ width: "50%" }}>
      <Form.Control
        type="search"
        placeholder="Search here"
        className="me-2"
        aria-label="Search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          borderRadius: "20px",
          padding: "8px 20px",
          border: "1px solid #ced4da",
          boxShadow: "none",
        }}
      />
      <Button variant="primary" onClick={onAddNew}>
        {buttonText || "Add New"}
      </Button>
    </div>
  );
};

export default SearchBar;