// import React, { useState, useEffect } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import Navbar from "../components/Navbar";
// import '../css/Analytics.css';
// import { toast } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';

// const UserHistoryPage = () => {
//   const { userId } = useParams();
//   const navigate = useNavigate();
//   const [logs, setLogs] = useState([]);
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         // Fetch user details
//         const userResponse = await fetch(`/api/users/${userId}`);
//         const userData = await userResponse.json();
//         setUser(userData);

//         // Fetch user logs
//         const logsResponse = await fetch(`/api/logtime/user/${userId}`, {
//           headers: {
//             'Authorization': `Bearer ${localStorage.getItem('token')}`
//           }
//         });
//         const logsData = await logsResponse.json();
//         setLogs(logsData);
//       } catch (error) {
//         console.error('Error fetching data:', error);
//         toast.error('Failed to fetch user history');
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, [userId]);

//   if (loading) {
//     return <div className="loading">Loading...</div>;
//   }

//   if (!user) {
//     return <div className="error">User not found</div>;
//   }

//   return (
//     <div className="analyst-page">
//       <Navbar />
      
//       <div className="analyst-container">
//         <div className="analyst-header">
//           <h2>User History: {user.firstname} {user.lastname}</h2>
//           <button 
//             className="btn-primary"
//             onClick={() => navigate(-1)}
//           >
//             Back to Users
//           </button>
//         </div>

//         <div className="table-responsive">
//           <table className="analyst-table">
//             <thead>
//               <tr>
//                 <th>Date</th>
//                 <th>Tasks</th>
//                 <th>Total Time</th>
//               </tr>
//             </thead>
//             <tbody>
//               {logs.length > 0 ? (
//                 logs.map(log => (
//                   <tr key={log._id}>
//                     <td>{log.date}</td>
//                     <td>
//                       <ul className="task-list">
//                         {log.logs.map((task, index) => (
//                           <li key={index}>
//                             <strong>{task.task}</strong>: {task.start} - {task.finish} ({task.timeSpent})
//                           </li>
//                         ))}
//                       </ul>
//                     </td>
//                     <td>
//                       {log.logs.reduce((total, task) => {
//                         const time = parseFloat(task.timeSpent.split(' ')[0]);
//                         return total + time;
//                       }, 0).toFixed(2)} hours
//                     </td>
//                   </tr>
//                 ))
//               ) : (
//                 <tr>
//                   <td colSpan="3" className="no-data">No log history found</td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default UserHistoryPage;