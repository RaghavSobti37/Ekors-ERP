import { Buffer } from 'buffer';
window.Buffer = Buffer;

import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./pages/Login.jsx";
import StaticInfo from "./pages/StaticInfo.jsx";
import Tickets from "./pages/Tickets.jsx";
import Quotations from "./pages/Quotations.jsx";
import History from "./pages/History";
import {ConfigService} from "./utils/ConfigService.js";
import Users from "./pages/Users";
import Challan from "./pages/Challan";
import Items from "./pages/Items.jsx";
import PurchaseHistory from "./pages/PurchaseHistory.jsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Unauthorized from "./components/Unauthorized.jsx";
import { ToastContainer } from "react-toastify"; // For react-toastify notifications
import "react-toastify/dist/ReactToastify.css"; // Import CSS for react-toastify

// Import new page components
import QuotationFormPage from "./minipages/quotations/QuotationFormPage.jsx";
import QuotationPreviewPage from "./minipages/quotations/QuotationPreviewPage.jsx";
import QuotationReportPage from "./minipages/quotations/QuotationReportPage.jsx";
import CreateTicketPage from "./components/CreateTicketModal.jsx"; // Assuming CreateTicketModal.jsx was refactored to CreateTicketPage
import PIPreviewPage from "./minipages/quotations/PIPreviewPage.jsx"; // Assuming you create this for PI Previews
import EditProfilePage from "./minipages/quotations/EditProfilePage.jsx"; // Import the new EditProfilePage
import EditTicketPage from "./minipages/tickets/EditTicketPage.jsx";
import TransferTicketPage from "./minipages/tickets/TransferTicketPage.jsx";
import TicketDetailsPage from "./minipages/tickets/TicketDetailsPage.jsx";
import TicketReportPage from "./minipages/tickets/TicketReportPage.jsx";
import CreateChallanPage from "./minipages/challans/CreateChallanPage";
import EditChallanPage from "./minipages/challans/EditChallanPage";
import ViewChallanPage from "./minipages/challans/ViewChallanPage";
import LogTimePage from "./pages/LogTimePage";
import ViewClientPage from "./minipages/clients/ViewClientPage";
import EditClientPage from "./minipages/clients/EditClientPage";
import ClientsPage from "./pages/ClientsPage.jsx"; // ClientsPage is now used for the /clients route
import BackupsPage from "./pages/BackupsPage.jsx"; // Import the new BackupsPage

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* ToastContainer for react-toastify notifications */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate replace to="/login" />} />{" "}
          {/* Redirect root to login */}
          <Route path="/login" element={<Login />} />
          {/* Removed direct routes to PDF components or generic components like Footer/Pagination */}
          <Route path="/users" element={<Users />} />
          {/* <Route path="/staticinfopage" element={<StaticInfoPage />} /> */}

          {/* Route for Clients Page */}
          <Route
            path="/clients"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/backups"
            element={
              <ProtectedRoute allowedRoles={["super-admin"]}> {/* Strictly super-admin */}
                <BackupsPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/clients/view/:id"
            element={<ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}><ViewClientPage /></ProtectedRoute>} // Allow user/admin to view their own
          />
          <Route
            path="/clients/edit/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}> {/* Allow user/admin owners to edit */}
                <EditClientPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <Tickets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/edit/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <EditTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/transfer/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <TransferTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/details/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <TicketDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/report"
            element={
              <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
                <TicketReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <Quotations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations/form"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <QuotationFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations/form/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <QuotationFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations/preview/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <QuotationPreviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations/report"
            element={
              <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
                <QuotationReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logtime"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <History />
              </ProtectedRoute>
            }
          />
          <Route path="/logtime/:date" element={<LogTimePage />} />
          <Route
            path="/challan"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <Challan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/challans"
            element={
              <ProtectedRoute>
                <Challan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/challans/create"
            element={
              <ProtectedRoute>
                <CreateChallanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/challans/edit/:id"
            element={
              <ProtectedRoute>
                <EditChallanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/challans/view/:id"
            element={
              <ProtectedRoute>
                <ViewChallanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/itemslist"
            element={
              <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
                <Items />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staticinfo"
            element={
              <ProtectedRoute allowedRoles={["super-admin"]}>
                <StaticInfo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchasehistory"
            element={
              <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
                <PurchaseHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/create-from-quotation"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <CreateTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/pi-preview"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <PIPreviewPage /> {/* Assuming PIPreviewPage.jsx exists */}
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "super-admin"]}>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<Navigate replace to="/login" />} />{" "}
          {/* Catch-all for undefined routes */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
