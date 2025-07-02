import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../utils/apiClient";
import { Spinner, Button, Card } from "react-bootstrap";
import ReusablePageStructure from "../../components/ReusablePageStructure";
import { normalizeItemPayload } from "../../utils/payloads";

export default function ViewItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);

  useEffect(() => {
    apiClient(`/items/${id}`).then(setItem);
  }, [id]);

  if (!item) return <ReusablePageStructure title="View Item"><Spinner animation="border" /></ReusablePageStructure>;

  const normalizedItem = normalizeItemPayload(item);

  return (
    <ReusablePageStructure title={`Item: ${normalizedItem.name}`}>
      <Card>
        <Card.Body>
          <div className="row">
            <div className="col-md-6">
              <h5>{normalizedItem.name}</h5>
              <p><strong>Category:</strong> {normalizedItem.category}</p>
              <p><strong>Quantity:</strong> {normalizedItem.quantity}</p>
              <p><strong>Selling Price:</strong> ₹{normalizedItem.sellingPrice}</p>
              <p><strong>Buying Price:</strong> ₹{normalizedItem.buyingPrice}</p>
              <p><strong>GST Rate:</strong> {normalizedItem.gstRate}%</p>
              <p><strong>HSN Code:</strong> {normalizedItem.hsnCode}</p>
              <p><strong>Max Discount %:</strong> {normalizedItem.maxDiscountPercentage}</p>
            </div>
            <div className="col-md-6">
              {normalizedItem.image && (
                <img src={normalizedItem.image} alt={normalizedItem.name} style={{ width: 200, height: 200, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
              )}
            </div>
          </div>
        </Card.Body>
      </Card>
      <div className="mt-3">
        <Button variant="primary" onClick={() => navigate(`/items/edit/${normalizedItem._id}`)}>Edit</Button>
      </div>
    </ReusablePageStructure>
  );
}