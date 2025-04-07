import React from "react";
import Navbar from "./components/Navbar";
import "./css/Challan.css";

const challanData = [
  { companyName: "bluepolaroid", totalBill: "1.18" },
  { companyName: "pixelcraze", totalBill: "2.50" },
  { companyName: "designhub", totalBill: "3.75" },
];

export default function Challan() {
  const handleCreateChallan = () => {
    alert("Redirecting to Create Challan form...");
    // You can use navigate("/create-challan") if using React Router
  };

  return (
    <div>
      <Navbar />
      <div className="challan-container">
        <div className="challan-header">
          <h2>Challan Records</h2>
          <button className="create-challan-btn" onClick={handleCreateChallan}>
            + Create Challan
          </button>
        </div>

        <table className="challan-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Total Bill (₹)</th>
              <th>View</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {challanData.map((entry, index) => (
              <tr key={index}>
                <td>{entry.companyName}</td>
                <td>{entry.totalBill}</td>
                <td>
                  <button
                    className="view-btn"
                    onClick={() => alert(`Viewing ${entry.companyName}`)}
                  >
                    👁️ View
                  </button>
                </td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => alert(`Editing ${entry.companyName}`)}
                  >
                    ✏️ Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
