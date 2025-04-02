import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TicketTable from '../components/TicketTable';
import NewTicketButton from '../components/NewTicketButton';
import '../components/css/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate(); // Navigation hook

  useEffect(() => {
    // Redirect to login if user is not authenticated
    if (!localStorage.getItem("isAuthenticated") && !localStorage.getItem("isGuest")) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (localStorage.getItem('isGuest')) {
      console.log('Guest user session');
      // You can add guest-specific logic here
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">New Ticket</h1>
        <NewTicketButton />
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Open Tickets</h2>
        <div className="flex space-x-4">
          <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            Cancel Tickets
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">History Transaksi</h2>
        <TicketTable />
      </div>
    </div>
  );
};

export default LandingPage;
