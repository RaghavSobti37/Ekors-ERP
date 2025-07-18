import React, { useCallback, useMemo } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import { generateQuotationDocx } from "../utils/generateQuotationDocx";
import * as docx from "docx";
import { saveAs } from "file-saver";
import ActionButtons from "./ActionButtons"; // Import ActionButtons

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  document: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  pageContent: {
    maxWidth: "100%",
    width: "100%",
  },

  logo: {
    width: 80,
    height: 60,
    objectFit: "contain",
  },
  refText: {
    color: "red",
    fontWeight: "bold",
    marginBottom: 5,
  },
  heading: {
    marginVertical: 10,
    fontSize: 13,
    textDecoration: "underline",
    fontWeight: "bold",
    textAlign: "center",
  },
  subjectLine: {
    marginVertical: 10,
    fontSize: 11, // Or your preferred size for normal text
    textAlign: "left",
    // fontWeight: "normal", // Default
  },
  section: {
    marginBottom: 10,
  },
  bodyText: {
    marginBottom: 5,
    textAlign: "justify",
  },
  table: {
    display: "table",
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableCol: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    padding: 4,
    textAlign: "center",
  },
  col1: { width: "8%" },
  col2: { width: "42%", textAlign: "left", paddingLeft: 5 },
  col3: { width: "10%" },
  col4: { width: "10%" },
  col5: { width: "15%" },
  col6: { width: "15%", borderRightWidth: 0 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    fontWeight: "bold",
    marginTop: 5,
  },
  terms: {
    marginTop: 15,
    fontSize: 10,
  },
  footer: {
    marginTop: 25,
    fontSize: 10,
    textAlign: "center",
    color: "red",
    fontWeight: "bold",
  },
  footerContact: {
    textAlign: "center",
    fontSize: 9,
    marginTop: 5,
  },
  subtextItem: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique", // Italic
    color: "#555", // Greyish color for subtext
    marginLeft: 10, // Indent subtext
    // paddingVertical: 1, // Small padding
  },
  headerSection: {
    flexDirection: "row", // Items in a row
    justifyContent: "space-between", // Pushes company info to left, logo to right
    alignItems: "center",
    marginBottom: 15,
  },
  gstinHeader: {
    fontSize: 10,
    marginBottom: 2,
  },
  companyNameHeader: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  companyAddressHeader: {
    // Added this style definition as it was used but not defined
    fontSize: 8,
    marginBottom: 5, // Adjusted margin
  },
  companyInfoContainer: {
    flex: 1, // Takes up available space
    flexDirection: "column",
    alignItems: "center", // Centers the text block horizontally
    textAlign: "center", // Centers the text lines
  },
  logoContainer: {
    // marginLeft: 10, // Optional: if you want some space between text and logo
  },
});

const QuotationActionsComponent = ({ quotation }) => {
  const handleDownloadWord = useCallback(async () => {
    try {
      const doc = await generateQuotationDocx(quotation); // Await the async function
      const blob = await docx.Packer.toBlob(doc);
      saveAs(blob, `quotation_${quotation.referenceNumber}.docx`);
    } catch (error) {
      console.error("Error generating Word document:", error);
      // Consider using a more integrated notification system if available, e.g., toast
      alert("Failed to generate Word document. Please try again.");
    }
  }, [quotation]);

  const pdfButtonProps = useMemo(
    () => ({
      document: <QuotationPDF quotation={quotation} />,
      fileName: `quotation_${quotation.referenceNumber}.pdf`,
    }),
    [quotation]
  );

  return (
    <ActionButtons
      item={quotation} // Pass the quotation item
      pdfProps={pdfButtonProps}
      onDownloadWord={handleDownloadWord}
      // Add other actions like onEdit, onView if needed for quotations list
    />
  );
};

// Component
const QuotationPDF = ({ quotation, companyInfo }) => {
  // companyInfo is now passed as a prop
  if (!companyInfo || !companyInfo.company) { // Still check if prop is valid
    return <Document><Page><Text>Loading company information...</Text></Page></Document>;
  }

  const { company } = companyInfo;
  return (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.document}>
        <View style={styles.pageContent}>
          {/* Centered Header with Logo */}
          <View style={styles.headerSection}>
              <View style={styles.companyInfoContainer}>
              <Text style={styles.gstinHeader}>GSTIN: {String(company.gstin ?? '')}</Text> {/* Ensure string */}
              <Text style={styles.companyNameHeader}>{String(company.companyName ?? '')}</Text> {/* Ensure string */}
              <Text style={styles.companyAddressHeader}> {/* Ensure address is always a string */}
                {String(company.addresses.companyAddress ?? '')}
              </Text>
            </View>
            <View style={styles.logoContainer}>
              <Image style={styles.logo} src="/logo.png" />
            </View>
          </View>

          {/* CIN and Date below the main header */}
          <Text style={styles.refText}>CIN NO.: {String(company.cin ?? '')}</Text> {/* Ensure CIN is always a string */}

          <Text>
            Date: {new Date(quotation.date).toLocaleDateString("en-GB")}
          </Text>


          <View style={styles.section}>
            <Text>To,</Text>
            <Text>{quotation.client.companyName}</Text>
            <Text>{quotation.client.clientName || "N/A"}</Text>
            {quotation.billingAddress && (
              <>
                <Text>
                  {quotation.billingAddress.address1 || ""}
                  {quotation.billingAddress.address2
                    ? `, ${quotation.billingAddress.address2}`
                    : ""}
                </Text>
                <Text>
                  {[
                    quotation.billingAddress.city,
                    quotation.billingAddress.state,
                  ]
                    .filter(Boolean)
                    .join(", ") +
                    (quotation.billingAddress.pincode
                      ? ` - ${quotation.billingAddress.pincode}`
                      : "")}
                </Text>
              </>
            )}
            {/* <Text>GSTIN: {quotation.client.gstNumber || "N/A"}</Text>
            <Text>Phone: {quotation.client.phone || "N/A"}</Text> */}
          </View>

          <Text style={styles.subjectLine}>
            Sub: Quotation for Earthing Material and Installation
          </Text>

          <Text style={styles.bodyText}>Dear Sir,</Text>
          <Text style={styles.bodyText}>
            Thanks for your enquiry of{" "}
            <Text style={{ fontStyle: "italic" }}>Earthing Items</Text>. As per
            your requirement here we are giving you, our prices. Kindly view it.
          </Text>

          <Text style={styles.heading}>Supply & Installation</Text>

          {/* Table Header */}
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCol, styles.col1]}>S.No</Text>
              <Text style={[styles.tableCol, styles.col2]}>
                Item description
              </Text>
              <Text style={[styles.tableCol, styles.col3]}>Unit</Text>
              <Text style={[styles.tableCol, styles.col4]}>Qty</Text>
              <Text style={[styles.tableCol, styles.col5]}>Rate</Text>
              <Text style={[styles.tableCol, styles.col6]}>Amount</Text>
            </View>

            {/* Table Rows */}
            {quotation.goods.map((item, index) => (
              <View style={styles.tableRow} key={index}>
                <Text style={[styles.tableCol, styles.col1]}>{index + 1}</Text>
                <View style={[styles.tableCol, styles.col2]}>
                  <Text>{item.description}</Text>
                  {item.subtexts &&
                    item.subtexts.map((sub, subIndex) => (
                      <Text key={subIndex} style={styles.subtextItem}>
                        - {sub}
                      </Text>
                    ))}
                </View>
                <Text style={[styles.tableCol, styles.col3]}>{item.unit}</Text>
                <Text style={[styles.tableCol, styles.col4]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.tableCol, styles.col5]}>
                  ₹{item.price.toFixed(2)}
                </Text>
                <Text style={[styles.tableCol, styles.col6]}>
                  ₹{item.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalRow}>
            <Text>Total: ₹{quotation.totalAmount.toFixed(2)}</Text>
          </View>

          {/* Terms & Conditions */}
          <View style={styles.terms}>
            <Text>Terms & Conditions:</Text>
            <Text>- Material Ex-Factory Noida</Text>
            <Text>- GST: 18% is applicable</Text>
            <Text>- Freight: Extra as applicable</Text>
            <Text>- Packing: Extra if applicable</Text>
            <Text>
              - Payment: 100% in advance after receiving Formal PO and Advance
            </Text>
            <Text>
              - Dispatch: Within {quotation.dispatchDays} days after receiving
              payment
            </Text>
            <Text>
              - Validity: This quotation is valid till{" "}
                        {new Date(quotation.validityDate).toLocaleDateString(
                "en-GB"
              )}

            </Text>
            <Text>
              - Order: Order to be placed in the name of "E-KORS PVT LTD"
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text>Hoping for your valuable order in the earliest.</Text>
            <Text>E-KORS PRIVATE LIMITED</Text>
          </View>

          <View style={styles.footerContact}>
            <Text style={styles.companyAddressHeader}>
              {company.addresses.companyAddress}
            </Text>
            <Text>Ph. No. {(company.contacts.contactNumbers || []).join(' / ')}</Text>
            <Text>Email: {String(company.contacts.email ?? '')}</Text> {/* Ensure email is always a string */}
          </View>
        </View>
      </View>
    </Page>
  </Document>
  );
};

export default QuotationPDF;

export const QuotationActions = React.memo(QuotationActionsComponent);
