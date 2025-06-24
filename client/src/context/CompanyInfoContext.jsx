import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/apiClient';
import LoadingSpinner from '../components/LoadingSpinner';

const CompanyInfoContext = createContext();

export const CompanyInfoProvider = ({ children }) => {
    const [companyInfo, setCompanyInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCompanyInfo = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch only the company marked as default for use in PDFs etc.
            const data = await apiClient('/company/default');
            setCompanyInfo(data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch default company info:", err);
            setError("Could not load default company information.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompanyInfo();
    }, [fetchCompanyInfo]);

    // The value now contains the default company info and a way to refresh it
    const value = { companyInfo, isLoading, error, refreshCompanyInfo: fetchCompanyInfo };

    return (
        <CompanyInfoContext.Provider value={value}>
            {children}
        </CompanyInfoContext.Provider>
    );
};

export const useCompanyInfo = () => {
    const context = useContext(CompanyInfoContext);
    if (context === undefined) {
        throw new Error('useCompanyInfo must be used within a CompanyInfoProvider');
    }
    return context;
};
