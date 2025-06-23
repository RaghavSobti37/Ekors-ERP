import React, { useState, useEffect, useContext } from 'react';
import { FaEye, FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext'; // Adjust path as needed
import apiClient from '../utils/apiClient'; // Adjust path as needed
import LoadingSpinner from '../components/LoadingSpinner'; // Adjust path as needed
import '../css/Style.css';


const StaticInfo = () => {
  const { user, logEventToServer } = useAuth();
  const [companyData, setCompanyData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch company data on component mount
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const data = await apiClient('/company/info');
        setCompanyData(data);
        setIsLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to fetch company data');
        setIsLoading(false);
        console.error('Error fetching company data:', err);
      }
    };

    fetchCompanyData();
  }, []);

  // Helper function to flatten nested objects for table display
  const flattenObject = (obj, prefix = '') => {
    if (!obj) return [];
    return Object.keys(obj).reduce((acc, key) => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        return [...acc, ...flattenObject(obj[key], newKey)];
      } else {
        return [...acc, { key: newKey, value: Array.isArray(obj[key]) ? obj[key].join(', ') : obj[key] }];
      }
    }, []);
  };

  const tableData = flattenObject(companyData);

  const handleEdit = (item) => {
    setIsEditing(true);
    setEditField(item.key);
    setEditValue(item.value);
  };

  const handleSave = async () => {
    if (!editField || !user) return;

    try {
      // Update the nested object structure
      const keys = editField.split('.');
      let updatedData = { ...companyData };
      let current = updatedData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] = { ...current[keys[i]] };
      }
      
      current[keys[keys.length - 1]] = editValue;

      // Send update to server
      const response = await apiClient('/company/info', {
        method: 'PUT',
        body: { field: editField, value: editValue }
      });

      setCompanyData(updatedData);
      setIsEditing(false);
      setEditField(null);

      // Log the update
      logEventToServer({
        type: 'companyDataUpdate',
        message: `Updated company field: ${editField}`,
        user: {
          id: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname
        },
        details: {
          field: editField,
          oldValue: tableData.find(item => item.key === editField)?.value,
          newValue: editValue
        }
      });

    } catch (err) {
      setError(err.message || 'Failed to update company data');
      console.error('Error updating company data:', err);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditField(null);
  };

  const handleView = (key, value) => {
    alert(`Viewing ${key}:\n\n${value}`);
  };

  const handleDelete = async (key) => {
    if (!window.confirm(`Are you sure you want to delete ${key}?`) || !user) return;

    try {
      // Send delete request to server
      await apiClient('/company/info', {
        method: 'DELETE',
        body: { field: key }
      });

      // Update the nested object structure
      const keys = key.split('.');
      let updatedData = { ...companyData };
      let current = updatedData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      delete current[keys[keys.length - 1]];
      setCompanyData(updatedData);

      // Log the deletion
      logEventToServer({
        type: 'companyDataDelete',
        message: `Deleted company field: ${key}`,
        user: {
          id: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname
        },
        details: {
          field: key,
          deletedValue: tableData.find(item => item.key === key)?.value
        }
      });

    } catch (err) {
      setError(err.message || 'Failed to delete company data');
      console.error('Error deleting company data:', err);
    }
  };

  if (isLoading) {
    return <LoadingSpinner show={true} />;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!companyData) {
    return <div className="no-data">No company data available</div>;
  }

  return (
    <div className="static-info-container">
      <h1>Company Information</h1>
      {user && (
        <p className="user-info">
          Logged in as: {user.firstname} {user.lastname} ({user.role})
        </p>
      )}
      <table className="static-info-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((item, index) => (
            <tr key={index}>
              <td>{item.key}</td>
              <td>
                {isEditing && editField === item.key ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="edit-input"
                    autoFocus
                  />
                ) : (
                  item.value
                )}
              </td>
              <td className="actions-cell">
                {isEditing && editField === item.key ? (
                  <>
                    <button onClick={handleSave} className="action-btn save-btn" title="Save">
                      <FaSave />
                    </button>
                    <button onClick={handleCancel} className="action-btn cancel-btn" title="Cancel">
                      <FaTimes />
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => handleView(item.key, item.value)} 
                      className="action-btn view-btn"
                      title="View"
                    >
                      <FaEye />
                    </button>
                    {user?.role === 'admin' && (
                      <>
                        <button 
                          onClick={() => handleEdit(item)} 
                          className="action-btn edit-btn"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.key)} 
                          className="action-btn delete-btn"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StaticInfo;