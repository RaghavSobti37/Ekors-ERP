// import React, { useState, useEffect } from 'react';
// import Navbar from "../components/Navbar";
// import Pagination from '../components/Pagination';
// import '../css/Analytics.css';
// import { toast } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';

// const AnalystPage = () => {
//   const [users, setUsers] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [currentPage, setCurrentPage] = useState(1);
//   const rowsPerPage = 10;

//   useEffect(() => {
//     const fetchUsers = async () => {
//       try {
//         const token = localStorage.getItem('token');
//         if (!token) {
//           throw new Error('No authentication token found');
//         }
  
//         const response = await fetch('http://localhost:3000/api/users', {
//           headers: {
//             'Authorization': `Bearer ${token}`
//           }
//         });
  
//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`);
//         }
  
//         const data = await response.json();
//         console.log('Received users:', data); // Debug log
  
//         if (!Array.isArray(data)) {
//           throw new Error('Expected array but got ' + typeof data);
//         }
  
//         setUsers(data);
//       } catch (error) {
//         console.error('Fetch error:', error);
//         toast.error(error.message);
//         setUsers([]); // Ensure empty state if error occurs
//       } finally {
//         setLoading(false);
//       }
//     };
  
//     fetchUsers();
//   }, []);

//   const totalPages = Math.ceil(users.length / rowsPerPage);
//   const displayedUsers = users.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

//   if (loading) {
//     return <div className="loading">Loading...</div>;
//   }

//   if (users.length === 0) {
//     return (
//       <div className="analyst-page">
//         <Navbar />
//         <div className="analyst-container">
//           <div className="no-users-message">
//             No users found. Please check your API connection.
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="analyst-page">
//       <Navbar />

//       <div className="analyst-container">
//         <div className="analyst-header">
//           <h2>User Management</h2>
//         </div>

//         <div className="table-responsive">
//           <table className="analyst-table">
//             <thead>
//               <tr>
//                 <th>Name</th>
//                 <th>Email</th>
//                 <th>Phone</th>
//                 <th>Total Ticket Value</th>
//                 <th>Role</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {displayedUsers.map(user => (
//                 <tr key={user._id}>
//                   <td>
//                     {user.firstname && user.lastname 
//                       ? `${user.firstname} ${user.lastname}`
//                       : 'Name not available'}
//                   </td>
//                   <td>{user.email || '-'}</td>
//                   <td>{user.phone || '-'}</td>
//                   <td>-</td>
//                   <td>{user.role || '-'}</td>
//                   <td>-</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>

//         <Pagination
//           currentPage={currentPage}
//           totalPages={totalPages}
//           onPageChange={(page) => {
//             if (page >= 1 && page <= totalPages) setCurrentPage(page);
//           }}
//         />
//       </div>
//     </div>
//   );
// };

// export default AnalystPage;
