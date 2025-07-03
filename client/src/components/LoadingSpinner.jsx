import React, { useState, useEffect, useCallback } from "react";
import { Spinner } from "react-bootstrap";
import "../css/LoadingSpinner.css"; // We'll create this CSS file next

const LoadingSpinner = ({ show }) => {
  // const [funFact, setFunFact] = useState("");
  // const [factLoading, setFactLoading] = useState(false);
  // const fetchFunFact = useCallback(async () => {
  //   setFactLoading(true);
  //   try {
  //     // Using a simple public API for random facts
  //     const response = await fetch(
  //       "https://uselessfacts.jsph.pl/random.json?language=en"
  //     );
  //     if (!response.ok) {
  //       throw new Error("Failed to fetch fun fact");
  //     }
  //     const data = await response.json();
  //     setFunFact(data.text);
  //   } catch (error) {
  //     console.error("Fun fact API error:", error);
  //     setFunFact(
  //       "Did you know? Loading screens were invented to entertain users during waits!"
  //     ); // Fallback fact
  //   } finally {
  //     setFactLoading(false);
  //   }
  // }, [setFactLoading, setFunFact]); // setFactLoading and setFunFact are stable

  // useEffect(() => {
  //   let intervalId = null;
  //   if (show) {
  //     fetchFunFact(); // Fetch immediately when shown
  //     intervalId = setInterval(fetchFunFact, 15000); // Then fetch every 15s while spinner is active
  //   }
  //   return () => {
  //     if (intervalId) {
  //       clearInterval(intervalId);
  //     }
  //   };
  // }, [show, fetchFunFact]);

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
        {/*
        {factLoading && <small>Fetching a fun fact...</small>}
        {!factLoading && funFact && (
          <small className="fun-fact">
            <em>Fun Fact: {funFact}</em>
          </small>
        )}
        */}
      </div>
    </div>
  );
};

export default React.memo(LoadingSpinner);
