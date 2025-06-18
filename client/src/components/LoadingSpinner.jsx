import React, { useState, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import '../css/LoadingSpinner.css'; // We'll create this CSS file next

const LoadingSpinner = ({ show }) => {
  const [funFact, setFunFact] = useState('');
  const [factLoading, setFactLoading] = useState(false);

  useEffect(() => {
    const fetchFunFact = async () => {
      if (show) { // Only fetch if the spinner is shown
        setFactLoading(true);
        try {
          // Using a simple public API for random facts
          const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
          if (!response.ok) {
            throw new Error('Failed to fetch fun fact');
          }
          const data = await response.json();
          setFunFact(data.text);
        } catch (error) {
          console.error("Fun fact API error:", error);
          setFunFact("Did you know? Loading screens were invented to entertain users during waits!"); // Fallback fact
        } finally {
          setFactLoading(false);
        }
      }
    };

    fetchFunFact();
    // Re-fetch fact if the spinner is shown again after being hidden
    // This ensures a new fact if the user navigates and another page loads
    const intervalId = setInterval(() => {
        if(show) fetchFunFact();
    }, 15000); // Fetch a new fact every 15 seconds while spinner is active

    return () => clearInterval(intervalId);
  }, [show]);

  if (!show) {
    return null;
  }

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading, please wait...</p>
        {factLoading && <small>Fetching a fun fact...</small>}
        {!factLoading && funFact && <small className="fun-fact"><em>Fun Fact: {funFact}</em></small>}
      </div>
    </div>
  );
};

export default LoadingSpinner;