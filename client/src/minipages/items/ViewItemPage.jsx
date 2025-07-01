import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../utils/apiClient";
import { Spinner, Button, Card } from "react-bootstrap";
import ReusablePageStructure from "../../components/ReusablePageStructure";

export default function ViewItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);

  useEffect(() => {
    apiClient(`/items/${id}`).then(setItem);
  }, [id]);

  if (!item) return <ReusablePageStructure title="View Item"><Spinner animation="border" /></ReusablePageStructure>;

  return (
    <ReusablePageStructure title={`Item: ${item.name}`}>
      <Card>
        <Card.Body>
          <div className="row">
            <div className="col-md-6">
              <h5>{item.name}</h5>
              <p><strong>Category:</strong> {item.category}</p>
              <p><strong>Quantity:</strong> {item.quantity}</p>
              <p><strong>Selling Price:</strong> ₹{item.sellingPrice}</p>
              <p><strong>Buying Price:</strong> ₹{item.buyingPrice}</p>
              <p><strong>GST Rate:</strong> {item.gstRate}%</p>
              <p><strong>HSN Code:</strong> {item.hsnCode}</p>
              <p><strong>Max Discount %:</strong> {item.maxDiscountPercentage}</p>
            </div>
            <div className="col-md-6">
              {item.image && (
                <img src={item.image} alt={item.name} style={{ width: 200, height: 200, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
              )}
            </div>
          </div>
        </Card.Body>
      </Card>
      <div className="mt-3">
        <Button variant="primary" onClick={() => navigate(`/items/edit/${item._id}`)}>Edit</Button>
      </div>
    </ReusablePageStructure>
  );
}