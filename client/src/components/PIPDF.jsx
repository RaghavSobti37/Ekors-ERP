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
    right: 30,
    top: 30,
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

const PIPDF = ({ invoice }) => {
  // Sample data matching the PDF
  const invoiceData = {
    quotationNo: "PI 118",
    date: "09-06-2025",
    company: {
      name: "E-KORS PRIVATE LIMITED",
      address: "POLE NO-02., Sector-115, NOIDA",
      city: "Gautam Buddha Nagar, Uttar Pradesh, 201307",
      gstin: "09AAFCE8706R1ZV",
    },
    client: {
      name: "M/s Kiranotics India Pvt Ltd",
      address: "D15, Site C, Industrial Area",
      city: "Sikandra",
      pincode: "282007",
      state: "Uttar Pradesh (09)",
      gstin: "09AACCK868101ZK",
      phone: "",
    },
    goods: [
      {
        sn: 1,
        description: "Earthing Rod\nUI Rod 250 Micron 3 Mir",
        hsnSacCode: "74071090",
        quantity: 4.00,
        unit: "NOS",
        price: 1000.00,
        amount: 4000.00,
      },
      {
        sn: 2,
        description: "Clamp",
        hsnSacCode: "85389000",
        quantity: 4.00,
        unit: "NOS",
        price: 150.00,
        amount: 600.00,
      },
      {
        sn: 3,
        description: "Chemical Bag",
        hsnSacCode: "73089090",
        quantity: 4.00,
        unit: "NOS",
        price: 200.00,
        amount: 800.00,
      },
      {
        sn: 4,
        description: "ESE LA\n5 Mir Mast\nTaura",
        hsnSacCode: "85354010",
        quantity: 1.00,
        unit: "NOS",
        price: 11500.00,
        amount: 11500.00,
      },
      {
        sn: 5,
        description: "Pit Cover\n6\"",
        hsnSacCode: "73259910",
        quantity: 4.00,
        unit: "NOS",
        price: 150.00,
        amount: 600.00,
      },
    ],
    tax: {
      taxableAmount: 17500.00,
      cgstRate: 9,
      cgstAmount: 1575.00,
      sgstRate: 9,
      sgstAmount: 1575.00,
      totalTax: 3150.00,
      grandTotal: 20650.00,
    },
    bankDetails: {
      bankName: "ICICI Bank",
      accountNo: "628405020990",
      ifsc: "ICIC0006284",
    },
  };

  // Calculate total quantity
  const totalQuantity = invoiceData.goods.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo in top right corner */}
        <Image style={styles.logo} src="/src/assets/logo.png" />
        <Text style={styles.invoiceTitle}>PERFORMA INVOICE</Text>
        <Text style={styles.companyName}>{invoiceData.company.name}</Text>
        <Text style={styles.subHeader}>
          {invoiceData.company.address}{"\n"}{invoiceData.company.city}
        </Text>
        <Text style={styles.header}>GSTIN : {invoiceData.company.gstin}</Text>

        {/* Quotation Header - Matches the image layout */}
        <View style={styles.quotationHeader}>
          <View style={styles.quotationHeaderCol}>
            <Text style={styles.quotationHeaderLabel}>Quotation No.:</Text>
            <Text>{invoiceData.quotationNo}</Text>
          </View>
          <View style={styles.quotationHeaderCol}>
            <Text style={styles.quotationHeaderLabel}>Date:</Text>
            <Text>{invoiceData.date}</Text>
          </View>
        </View>

        {/* Client Details - Matches the image layout */}
        <View style={styles.clientDetailsTable}>
          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text style={styles.clientDetailsLabel}>Quotation to:</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text style={styles.clientDetailsLabel}>Shipped to:</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.name}</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.name}</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.address}</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.address}</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.city}</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.city}</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.pincode}</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>{invoiceData.client.pincode}</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text style={styles.clientDetailsLabel}>Party Mobile No:</Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text style={styles.clientDetailsLabel}>Party Mobile No:</Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>State: </Text>
                {invoiceData.client.state}
              </Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>State:</Text>
                {invoiceData.client.state}
              </Text>
            </View>
          </View>

          <View style={styles.clientDetailsRow}>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>GSTIN / UIN:</Text>
                {invoiceData.client.gstin}
              </Text>
            </View>
            <View style={styles.clientDetailsCol}>
              <Text>
                <Text style={styles.clientDetailsLabel}>GSTIN / UIN:</Text>
                {invoiceData.client.gstin}
              </Text>
            </View>
          </View>
        </View>

        {/* Items Table with proper borders */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: "5%" }]}>S.N</Text>
            <Text style={[styles.tableHeaderCell, { width: "35%" }]}>Description of Goods</Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>HSN/SAC Code</Text>
            <Text style={[styles.tableHeaderCell, { width: "8%" }]}>Qty.</Text>
            <Text style={[styles.tableHeaderCell, { width: "8%" }]}>Unit</Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>Price</Text>
            <Text style={[styles.tableHeaderCell, { width: "12%", borderRight: 0 }]}>Amount( )</Text>
          </View>

          {/* Table Rows */}
          {invoiceData.goods.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, { width: "5%" }]}>{item.sn}.</Text>
              <Text style={[styles.descriptionCell, { width: "35%" }]}>{item.description}</Text>
              <Text style={[styles.tableCell, { width: "12%" }]}>{item.hsnSacCode}</Text>
              <Text style={[styles.tableCell, { width: "8%" }]}>{item.quantity.toFixed(2)}</Text>
              <Text style={[styles.tableCell, { width: "8%" }]}>{item.unit}</Text>
              <Text style={[styles.tableCell, { width: "12%" }]}>{item.price.toFixed(2)}</Text>
              <Text style={[styles.tableCell, { width: "12%", borderRight: 0 }]}>{item.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* GST Calculation */}
        <View style={styles.gstRow}>
          <Text style={styles.gstCell}>Add: CGST</Text>
          <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
          <Text style={[styles.gstCell, { width: "8%" }]}>{invoiceData.tax.cgstRate.toFixed(2)} %</Text>
          <Text style={[styles.gstCell, { width: "12%" }]}>{invoiceData.tax.cgstAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.gstRow}>
          <Text style={styles.gstCell}>Add: SGST</Text>
          <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
          <Text style={[styles.gstCell, { width: "8%" }]}>{invoiceData.tax.sgstRate.toFixed(2)} %</Text>
          <Text style={[styles.gstCell, { width: "12%" }]}>{invoiceData.tax.sgstAmount.toFixed(2)}</Text>
        </View>

        {/* Grand Total */}
        <View style={styles.grandTotal}>
          <Text style={styles.bold}>Grand Total</Text>
          <Text>
            {totalQuantity.toFixed(2)} NOS {invoiceData.tax.grandTotal.toFixed(2)}
          </Text>
        </View>

        {/* Tax Summary Table */}
        <View style={styles.taxTable}>
          <View style={styles.taxTableRow}>
            <Text style={[styles.taxTableCell, styles.bold]}>Tax Rate</Text>
            <Text style={[styles.taxTableCell, styles.bold]}>Taxable Amt.</Text>
            <Text style={[styles.taxTableCell, styles.bold]}>CGST Amt.</Text>
            <Text style={[styles.taxTableCell, styles.bold]}>SGST Amt.</Text>
            <Text style={[styles.taxTableLastCell, styles.bold]}>Total Tax</Text>
          </View>
          <View style={styles.taxTableRow}>
            <Text style={styles.taxTableCell}>{invoiceData.tax.cgstRate + invoiceData.tax.sgstRate}%</Text>
            <Text style={styles.taxTableCell}>{invoiceData.tax.taxableAmount.toFixed(2)}</Text>
            <Text style={styles.taxTableCell}>{invoiceData.tax.cgstAmount.toFixed(2)}</Text>
            <Text style={styles.taxTableCell}>{invoiceData.tax.sgstAmount.toFixed(2)}</Text>
            <Text style={styles.taxTableLastCell}>{invoiceData.tax.totalTax.toFixed(2)}</Text>
          </View>
        </View>

        {/* Amount in Words */}
        <Text style={styles.amountInWords}>
          Rupees {toWords(invoiceData.tax.grandTotal)}
        </Text>

        {/* Bank Details */}
        <View style={styles.bankDetails}>
          <Text style={styles.bold}>
            Bank Details : {invoiceData.bankDetails.bankName}{"\n"}
            Bank Account No:-{invoiceData.bankDetails.accountNo}, IFSC CODE No.{invoiceData.bankDetails.ifsc}
          </Text>
        </View>

        {/* Signature */}
        <View style={styles.signature}>
          <Text>for {invoiceData.company.name}</Text>
          <Text>Authorised Signatory</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PIPDF;