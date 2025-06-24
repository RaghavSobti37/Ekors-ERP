import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, VerticalAlign } from "docx";

export const generateQuotationDocx = async (quotation) => {
  // Prepare billing address lines safely
  const billingAddressLine1 = quotation.billingAddress
    ? `${quotation.billingAddress.address1 || ""}${quotation.billingAddress.address2 ? `, ${quotation.billingAddress.address2}` : ""}`
    : "";
  const billingAddressLine2 = quotation.billingAddress
    ? [
        quotation.billingAddress.city,
        quotation.billingAddress.state,
      ].filter(Boolean).join(", ") + (quotation.billingAddress.pincode ? ` - ${quotation.billingAddress.pincode}` : "")
    : "";

  let imageBuffer = null;
  try {
    // Assumes logo.png is in the public folder or accessible via this path
    const response = await fetch("/logo.png");
    if (response.ok) {
      imageBuffer = await response.arrayBuffer();
    } else {
      console.error("Logo image not found or fetch failed:", response.status);
    }
  } catch (error) {
    console.error("Error fetching logo image:", error);
  }

  // Define no borders for the layout table
  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
  };

  // Create the left cell for company info (centered)
  const companyInfoCell = new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "GSTIN: 09AAFCE8706R1ZV", size: 20 })], // 10pt
        spacing: { after: 50 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "E-KORS PRIVATE LIMITED", bold: true, allCaps: true, size: 28 })], // 14pt
        spacing: { after: 50 }
      }),
      new Paragraph({
        text: "PLOT NO.-02, Sector-115, NOIDA, Gautam Buddha Nagar, Uttar Pradesh, 201307",
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 } // No space after address within the cell
      }),
    ],
    borders: noBorders,
    // Adjust width based on whether logo is present
    width: { size: imageBuffer ? 85 : 100, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER, // Vertically center content in the cell
  });

  // Create the right cell for the logo (right-aligned)
  const logoCell = new TableCell({
    children: imageBuffer ? [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new ImageRun({ data: imageBuffer, transformation: { width: 80, height: 60 } })],
      }),
    ] : [], // Empty children if no image
    borders: noBorders,
    width: { size: imageBuffer ? 15 : 0, type: WidthType.PERCENTAGE }, // Give width only if logo is present
    verticalAlign: VerticalAlign.CENTER, // Vertically center content in the cell
  });

  // Create the header row with the two cells
  const headerRow = new TableRow({
    children: [companyInfoCell, logoCell],
  });

  // Create the header table
  const headerTable = new Table({
    rows: [headerRow],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    spacing: { after: 150 } // Space after the header table block
  });


  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header Table (Company Info Centered, Logo Right)
        headerTable,

        // CIN No. (as per PDF)
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: "CIN NO.: U40106UP2020PTC127954", color: "FF0000", bold: true })],
          spacing: { after: 50 }
        }),
        // Date (as per PDF)
        new Paragraph({
          text: `Date: ${new Date(quotation.date).toLocaleDateString()}`,
          alignment: AlignmentType.LEFT,
          spacing: { after: 200 } // Space before "To,"
        }),

        // "To" Section
        new Paragraph({
          text: "To,",
          spacing: { after: 50 }
        }),
        new Paragraph({
          text: quotation.client.companyName,
          spacing: { after: 50 }
        }),
        new Paragraph({
          text: quotation.client.clientName || "N/A",
          spacing: { after: 50 }
        }),
        ...(billingAddressLine1 ? [new Paragraph({ text: billingAddressLine1, spacing: { after: 50 } })] : []),
        ...(billingAddressLine2 ? [new Paragraph({ text: billingAddressLine2, spacing: { after: 300 } })] : [new Paragraph({text: "", spacing: { after: 300 }})]), // Ensure spacing even if address is empty


        // Subject Line
        new Paragraph({
          text: "Sub: Quotation for Earthing Material and Installation",
          alignment: AlignmentType.LEFT,
          spacing: { before: 100, after: 200 } // Adjusted spacing for normal text flow
        }),

        // Salutation
        new Paragraph({
          text: "Dear Sir,",
          spacing: { after: 200 }
        }),

        // Body text
        new Paragraph({
          children: [
            new TextRun("Thanks for your enquiry of "),
            new TextRun({
              text: "Earthing Items",
              italics: true
            }),
            new TextRun(". As per your requirement here we are giving you, our prices. Kindly view it.")
          ],
          spacing: { after: 300 }
        }),

        // Table title
        new Paragraph({
          text: "Supply & Installation",
          heading: HeadingLevel.HEADING_2, // Kept as H2 as it's a section title, PDF uses a similar "heading" style
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),

        // Create table for items
        createItemsTable(quotation.goods),

        // Total row
        new Paragraph({
          text: `Total: ₹${quotation.totalAmount.toFixed(2)}`,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200, after: 400 }
        }),

        // Terms and conditions
        new Paragraph({
          text: "Terms & Conditions:",
          spacing: { after: 100 }
        }),
        ...createTermsAndConditions(quotation),

        // Footer
        new Paragraph({
          text: "Hoping for your valuable order in the earliest.",
          alignment: AlignmentType.CENTER,
          // color: "FF0000", // PDF footer text is red, but this specific line is not in PDF
          // bold: true,      // PDF footer text is red and bold for "E-KORS PRIVATE LIMITED"
          spacing: { before: 400, after: 100 }
        }),
        new Paragraph({ // This line matches the PDF footer style
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "E-KORS PRIVATE LIMITED", color: "FF0000", bold: true})],
          spacing: { after: 100 } // Adjusted spacing to match PDF more closely
        }),

        // Contact info
        new Paragraph({
          text: "Com Add: Pole No. 02, Sector 115 Noida - 201307",
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 }
        }),
        new Paragraph({
          text: "Ph. No. 9711725989 / 9897022545",
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 }
        }),
        new Paragraph({
          text: "Email: sales@ekors.in",
          alignment: AlignmentType.CENTER
        })
      ]
    }]
  });

  return doc;
};

function createItemsTable(goods) {
  // Table header
  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph("S.No")], width: { size: 8, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Item description")], width: { size: 42, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Unit")], width: { size: 10, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Qty")], width: { size: 10, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Rate")], width: { size: 15, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Amount")], width: { size: 15, type: WidthType.PERCENTAGE } })
    ]
  });

  // Table rows for items
  const itemRows = goods.map((item, index) => {
    const descriptionChildren = [
      new Paragraph(item.description)
    ];

    // Add subtexts if they exist
    if (item.subtexts && item.subtexts.length > 0) {
      item.subtexts.forEach(subtext => {
        descriptionChildren.push(
          new Paragraph({ // For subtexts, consider using TextRun if more specific styling like font size is needed
            children: [
              new TextRun({
                text: `- ${subtext}`,
                italics: true,
                color: "555555", // Greyish
                // size: 18 // Corresponds to 9pt font size in PDF
              })
            ],
            indent: { left: 200 } // Indent for subtext
          })
        );
      });
    }

    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph((index + 1).toString())] }),
        new TableCell({ children: descriptionChildren }),
        new TableCell({ children: [new Paragraph(item.unit)] }),
        new TableCell({ children: [new Paragraph(item.quantity.toString())] }),
        new TableCell({ children: [new Paragraph(`₹${item.price.toFixed(2)}`)] }),
        new TableCell({ children: [new Paragraph(`₹${item.amount.toFixed(2)}`)] })
      ]
    });
  });

  return new Table({
    rows: [headerRow, ...itemRows],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
}

function createTermsAndConditions(quotation) {
  return [
    new Paragraph("- Material Ex-Factory Noida"),
    new Paragraph("- GST: 18% is applicable"),
    new Paragraph("- Freight: Extra as applicable"),
    new Paragraph("- Packing: Extra if applicable"),
    new Paragraph("- Payment: 100% in advance after receiving Formal PO and Advance"),
    new Paragraph(`- Dispatch: Within ${quotation.dispatchDays || "X"} days after receiving payment`),
    new Paragraph(`- Validity: This quotation is valid till ${new Date(quotation.validityDate).toLocaleDateString()}`),
    new Paragraph("- Order: Order to be placed in the name of \"E-KORS PVT LTD\"")
  ].map(p => {
    // Ensure consistent spacing for terms list items
    if (p.properties) {
        p.properties.spacing = { ...p.properties.spacing, after: 50 };
    } else {
        p.properties = { spacing: { after: 50 } };
    }
    return p;
  });
}
