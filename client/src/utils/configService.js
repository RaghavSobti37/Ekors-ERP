let appConfig = {};

export const ConfigService = async () => {
    try {
        const response = await fetch('/appconfig.json');
        const data = await response.json();
        appConfig = data;
        return data;
    } catch (error) {
        console.error('Failed to load configuration:', error);
        // Fallback configuration
        appConfig = {
            company: {
                companyName: "E-KORS PRIVATE LIMITED",
                gstin: "09AAICE2056P1Z5",
                cin: "U40106UP2020PTC127954",
                addresses: {
                    companyAddress: "PLOT NO.-02, Sector-115, NOIDA, Gautam Buddha Nagar, Uttar Pradesh, 201307",
                    officeAddress: "A-1, Sector-59, Noida-201301"
                },
                contacts: {
                    contactNumbers: ["9711725989", "9897022545"],
                    email: "sales@ekors.in"
                }

            }
        };
        return appConfig;
    }
};

export const getConfig = () => appConfig;
export const getCompanyInfo = () => appConfig.company || {};
export const getQuotationSettings = () => appConfig.quotation || {};
export const getOtherSettings = () => appConfig.otherSettings || {};

// export default {
//   loadAppConfig,
//   getConfig,
//   getCompanyInfo,
//   getQuotationSettings,
//   getOtherSettings
// };