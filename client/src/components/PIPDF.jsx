import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 11,
    position: "relative",
  },
  logo: {
    position: "absolute",
    left: 30, // changed from 'right' to 'left'
    top: 30, // keep it at the top
    width: 80,
    height: "auto",
  },
  header: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subHeader: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 10,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    textDecoration: "underline",
  },
  detailsTable: {
    width: "100%",
    marginBottom: 10,
    border: "1px solid #000",
  },
  detailsRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
  },
  detailsCell: {
    padding: 5,
    borderRight: "1px solid #000",
    flex: 1,
  },
  detailsLastCell: {
    padding: 5,
    flex: 1,
  },
  bold: {
    fontWeight: "bold",
  },
  tableContainer: {
    width: "100%",
    marginTop: 15,
    border: "1px solid #000",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    backgroundColor: "#f0f0f0",
  },
  tableHeaderCell: {
    padding: 5,
    borderRight: "1px solid #000",
    textAlign: "center",
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
  },
  tableCell: {
    padding: 5,
    borderRight: "1px solid #000",
    textAlign: "center",
  },
  descriptionCell: {
    padding: 5,
    borderRight: "1px solid #000",
    textAlign: "left",
    width: "35%",
  },
  lastCell: {
    padding: 5,
    textAlign: "center",
  },
  taxSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    width: "100%",
  },
  taxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 5,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 5,
    borderTop: "1px solid #000",
    paddingTop: 5,
  },
  amountInWords: {
    marginTop: 10,
    fontStyle: "italic",
  },
  bankDetails: {
    marginTop: 15,
    borderTop: "1px solid #000",
    paddingTop: 10,
    width: "100%",
  },
  signature: {
    marginTop: 30,
    textAlign: "right",
    width: "100%",
  },
  gstRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    marginBottom: 5,
  },
  gstCell: {
    width: "20%",
    textAlign: "right",
    paddingRight: 10,
  },
  taxTable: {
    width: "100%",
    marginTop: 10,
    border: "1px solid #000",
  },
  taxTableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
  },
  taxTableCell: {
    padding: 5,
    borderRight: "1px solid #000",
    width: "20%",
    textAlign: "center",
  },
  taxTableLastCell: {
    padding: 5,
    width: "20%",
    textAlign: "center",
  },
  quotationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  quotationHeaderCol: {
    flexDirection: "row",
  },
  quotationHeaderLabel: {
    fontWeight: "bold",
    marginRight: 5,
  },
  clientDetailsTable: {
    width: "100%",
    marginBottom: 10,
  },
  clientDetailsRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  clientDetailsCol: {
    width: "50%",
  },
  clientDetailsLabel: {
    fontWeight: "bold",
    marginRight: 5,
  },
});

const toWords = (num) => {
  if (num === 0) return "Zero";

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const g = ["", "Thousand", "Lakh", "Crore"];

  const floatPart = Math.round((num - Math.floor(num)) * 100);
  num = Math.floor(num);

  let str = "";
  let i = 0;

  const convertChunk = (n) => {
    let s = "";
    if (n > 99) {
      s += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 19) {
      s += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else {
      s += a[n];
    }
    return s.trim();
  };

  while (num > 0) {
    const chunk = i === 0 ? num % 1000 : num % 100;
    if (chunk !== 0) {
      str = convertChunk(chunk) + (g[i] ? " " + g[i] : "") + " " + str;
    }
    num = i === 0 ? Math.floor(num / 1000) : Math.floor(num / 100);
    i++;
  }

  return (
    str.trim() +
    (floatPart > 0 ? " and " + convertChunk(floatPart) + " Paise" : "") +
    " Only"
  );
};

const PIPDF = ({ ticket }) => {
  // Static company and bank details (can be made dynamic later if needed)
  const ourCompany = {
    PI_NO: "PI 118",
    date: "09-06-2025",
    company: {
      name: "E-KORS PRIVATE LIMITED",
      address: "POLE NO-02., Sector-115, NOIDA",
      city: "Gautam Buddha Nagar, Uttar Pradesh, 201307",
      gstin: "09AAFCE8706R1ZV",
    },
    bankDetails: {
      bankName: "ICICI Bank",
      accountNo: "628405020990",
      ifsc: "ICIC0006284",
    },
  };

  // Calculate total quantity
  const totalQuantity = (ticket.goods || []).reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo in top right corner */}
        <Image style={styles.logo} src="/src/assets/logo.png" />
        <Text style={styles.invoiceTitle}>PERFORMA INVOICE</Text>
        <Text style={styles.companyName}>{ourCompany.company.name}</Text>
        <Text style={styles.subHeader}>
          {ourCompany.company.address}
          {"\n"}
          {ourCompany.company.city}
        </Text>
        <Text style={styles.header}>GSTIN : {ourCompany.company.gstin}</Text>

        {/* Quotation Header - Matches the image layout */}
        <View style={styles.quotationHeader}>
          <View style={styles.quotationHeaderCol}>
            <Text style={styles.quotationHeaderLabel}>PI No.:</Text>
            <Text>{ticket.piNumber || ticket.quotationNumber}</Text>
          </View>
          <View style={styles.quotationHeaderCol}>
            <Text style={styles.quotationHeaderLabel}>Date:</Text>
            <Text>
              {new Date(
                ticket.piDate || ticket.createdAt || Date.now()
              ).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Client Details - Matches the image layout */}
        <View style={styles.clientDetailsTable}>
          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text style={styles.clientDetailsLabel}>Billed to:</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text style={styles.clientDetailsLabel}>Shipped to:</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{ticket.clientName || ticket.companyName}</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>
                {ticket.shippingSameAsBilling
                  ? ticket.clientName || ticket.companyName
                  : ticket.shippingAddressResolved?.companyName ||
                    ticket.clientName ||
                    ticket.companyName}
              </Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{ticket.billingAddressResolved?.address1}</Text>
              {ticket.billingAddressResolved?.address2 && (
                <Text>{ticket.billingAddressResolved.address2}</Text>
              )}
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>{ticket.shippingAddressResolved?.address1}</Text>
              {ticket.shippingAddressResolved?.address2 && (
                <Text>{ticket.shippingAddressResolved.address2}</Text>
              )}
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{ticket.billingAddressResolved?.city}</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>{ticket.shippingAddressResolved?.city}</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{ticket.billingAddressResolved?.pincode}</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>{ticket.shippingAddressResolved?.pincode}</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text style={styles.clientDetailsLabel}>Party Mobile No:</Text>
              <Text>
                {ticket.clientPhoneNum || ticket.clientPhone || "N/A"}
              </Text>
            </View>
            <View style={styles.clientDetailsCol}>
              {/* Intentionally left blank for shipping side as per common PI formats, or can mirror if needed */}
              <Text style={styles.clientDetailsLabel}>Party Mobile No:</Text>
              <Text>
                {ticket.shippingSameAsBilling
                  ? ticket.clientPhoneNum || "N/A"
                  : ticket.shippingAddressResolved?.phone || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>State: </Text>
                {ticket.billingAddressResolved?.state}
              </Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>State:</Text>
                {ticket.shippingAddressResolved?.state}
              </Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>GSTIN / UIN:</Text>
                {ticket.clientGst || ticket.clientGstNumber || "N/A"}{" "}
              </Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>GSTIN / UIN:</Text>
                {ticket.shippingSameAsBilling
                  ? ticket.clientGst || "N/A"
                  : ticket.shippingAddressResolved?.gstin || "N/A"}
              </Text>
            </View>
          </View>
        </View>

        {/* Items Table with proper borders */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: "5%" }]}>S.N</Text>
            <Text style={[styles.tableHeaderCell, { width: "35%" }]}>
              Description of Goods
            </Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
              HSN/SAC Code
            </Text>
            <Text style={[styles.tableHeaderCell, { width: "8%" }]}>Qty.</Text>
            <Text style={[styles.tableHeaderCell, { width: "8%" }]}>Unit</Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
              Price
            </Text>
            <Text
              style={[styles.tableHeaderCell, { width: "12%", borderRight: 0 }]}
            >
              Amount( )
            </Text>
          </View>

          {/* Table Rows */}
          {(ticket.goods || []).map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, { width: "5%" }]}>
                {item.sn || i + 1}.
              </Text>
              <Text style={[styles.descriptionCell, { width: "35%" }]}>
                {item.description}
              </Text>
              <Text style={[styles.tableCell, { width: "12%" }]}>
                {item.hsnSacCode}
              </Text>
              <Text style={[styles.tableCell, { width: "8%" }]}>
                {(item.quantity || 0).toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { width: "8%" }]}>
                {item.unit || "Nos"}
              </Text>
              <Text style={[styles.tableCell, { width: "12%" }]}>
                {(item.price || 0).toFixed(2)}
              </Text>
              <Text
                style={[styles.tableCell, { width: "12%", borderRight: 0 }]}
              >
                {(item.amount || 0).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* GST Calculation */}
        {ticket.isSameState ? (
          <>
            <View style={styles.gstRow}>
              <Text style={styles.gstCell}>Add: CGST</Text>
              <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
              <Text style={[styles.gstCell, { width: "8%" }]}>
                {(ticket.gstRate || 0).toFixed(2)} %
              </Text>
              <Text style={[styles.gstCell, { width: "12%" }]}>
                {((ticket.gstAmount || 0) / 2).toFixed(2)}
              </Text>
            </View>
            <View style={styles.gstRow}>
              <Text style={styles.gstCell}>Add: SGST</Text>
              <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
              <Text style={[styles.gstCell, { width: "8%" }]}>
                {(ticket.gstRate || 0).toFixed(2)} %
              </Text>
              <Text style={[styles.gstCell, { width: "12%" }]}>
                {((ticket.gstAmount || 0) / 2).toFixed(2)}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.gstRow}>
            <Text style={styles.gstCell}>Add: IGST</Text>
            <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
            <Text style={[styles.gstCell, { width: "8%" }]}>
              {(ticket.gstRate || 0).toFixed(2)} %
            </Text>
            <Text style={[styles.gstCell, { width: "12%" }]}>
              {(ticket.gstAmount || 0).toFixed(2)}
            </Text>
          </View>
        )}

        {/* Grand Total */}
        <View style={styles.grandTotal}>
          <Text style={styles.bold}>Grand Total</Text>
          <Text>
            {totalQuantity.toFixed(2)} NOS {(ticket.grandTotal || 0).toFixed(2)}
          </Text>
        </View>

        {/* Tax Summary Table */}
        <View style={styles.taxTable}>
          <View style={styles.taxTableRow}>
            <Text style={[styles.taxTableCell, styles.bold]}>
              {ticket.isSameState ? "Tax Rate" : "IGST Rate"}
            </Text>
            <Text style={[styles.taxTableCell, styles.bold]}>Taxable Amt.</Text>
            <Text style={[styles.taxTableCell, styles.bold]}>
              {ticket.isSameState ? "CGST Amt." : "IGST Amt."}
            </Text>
            {ticket.isSameState && (
              <Text style={[styles.taxTableCell, styles.bold]}>SGST Amt.</Text>
            )}
            <Text style={[styles.taxTableLastCell, styles.bold]}>
              Total Tax
            </Text>
          </View>
          <View style={styles.taxTableRow}>
            <Text style={styles.taxTableCell}>
              {ticket.isSameState
                ? `${(ticket.gstRate || 0) * 2}%`
                : `${ticket.gstRate || 0}%`}
            </Text>
            <Text style={styles.taxTableCell}>
              {(ticket.totalAmount || 0).toFixed(2)}
            </Text>
            {ticket.isSameState ? (
              <>
                <Text style={styles.taxTableCell}>
                  {((ticket.gstAmount || 0) / 2).toFixed(2)}
                </Text>
                <Text style={styles.taxTableCell}>
                  {((ticket.gstAmount || 0) / 2).toFixed(2)}
                </Text>
              </>
            ) : (
              <Text style={styles.taxTableCell}>
                {(ticket.gstAmount || 0).toFixed(2)}
              </Text>
            )}
            <Text style={styles.taxTableLastCell}>
              {(ticket.gstAmount || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Amount in Words */}
        <Text style={styles.amountInWords}>
          Rupees {toWords(ticket.grandTotal || 0)}
        </Text>

        {/* Bank Details */}
        <View style={styles.bankDetails}>
          <Text style={styles.bold}>
            Bank Details : {ourCompany.bankDetails.bankName}
            {"\n"}
            Bank Account No:-{ourCompany.bankDetails.accountNo}, IFSC CODE No.
            {ourCompany.bankDetails.ifsc}
          </Text>
        </View>

        {/* Signature */}
        <View style={styles.signature}>
          <Text>for {ourCompany.company.name}</Text>
          <Text>Authorised Signatory</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PIPDF;
