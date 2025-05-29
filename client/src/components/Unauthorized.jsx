import Navbar from "./Navbar.jsx";

export default function Unauthorized() {
    return (
       <div>
        <Navbar />

      <div className="text-center mt-5">
        <h2>403 - Unauthorized Access</h2>
        <p>You do not have permission to view this page.</p>
      </div>
      </div>
    );
  }
  