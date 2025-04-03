import React, { useEffect, useState } from "react";
import Navbar from './components/Navbar.jsx'; // Ensure the correct path

export default function Dashboard() {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    // Dummy Data (Replace with actual fetched data)
    setTickets([
      { company: "Tesla Motors", type: "Service", createdOn: "15 Mar 2024", amount: "$299.99" },
      { company: "Apple Inc.", type: "Warranty", createdOn: "12 Mar 2024", amount: "$150" },
      { company: "Microsoft Corp", type: "Software", createdOn: "10 Mar 2024", amount: "$99.99" },
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      {/* Navbar Added Here */}
      <Navbar />  

      <div className="p-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Open Tickets</h1>
          <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">
            New Ticket
          </button>
        </div>

        {/* Table Section */}
        <div className="mt-8 bg-[#22223b] p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-semibold mb-4">Open Ticket List</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#2c2c54] text-left">
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Created On</th>
                  <th className="p-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, index) => (
                  <tr key={index} className="border-t border-gray-600">
                    <td className="p-3">{ticket.company}</td>
                    <td className="p-3">{ticket.type}</td>
                    <td className="p-3">{ticket.createdOn}</td>
                    <td className="p-3 text-blue-400">{ticket.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
