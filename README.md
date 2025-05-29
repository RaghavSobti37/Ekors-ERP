# ERP System Documentation

## Overview

This ERP (Enterprise Resource Planning) system is a full-stack solution built to streamline business operations such as client management, inventory, quotations, ticketing, purchases, time logging, and challan generation. The frontend is developed using **React.js**, and the backend is built on **Node.js**, **Express**, and **MongoDB**.

---

## 📁 File Structure

### 🖥️ Client (Frontend)

```
client/
├── public/                  # Static files
├── src/
│   ├── assets/              # Images, logos, etc.
│   ├── components/          # Reusable UI components
│   ├── context/             # React context for global state
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page-level components
│   │   ├── Challan.jsx
│   │   ├── History.jsx
│   │   ├── Itemslist.jsx
│   │   ├── Login.jsx
│   │   ├── Logtime.jsx
│   │   ├── Quotations.jsx
│   │   ├── Signup.jsx
│   │   └── Tickets.jsx
│   ├── services/            # API service handlers
│   ├── utils/               # Utility functions
│   ├── App.jsx              # App layout and routing
│   └── main.jsx             # Entry point
├── vite.config.js           # Vite bundler config
├── package.json             # Project metadata
├── package-lock.json
├── README.md
└── .gitignore
```

### 🖥️ Server (Backend)

```
server/
├── middleware/              # Express middlewares
├── models/                  # Mongoose schemas
│   ├── challan.js
│   ├── client.js
│   ├── item.js
│   ├── logTime.js
│   ├── opentickets.js
│   ├── purchase.js
│   ├── quotation.js
│   ├── supplier.js
│   └── user.js
├── routes/                  # API routes
│   ├── challanRoutes.js
│   ├── clientRoutes.js
│   ├── itemRoutes.js
│   ├── logTimeRoutes.js
│   ├── purchaseRoutes.js
│   ├── quotationRoutes.js
│   ├── supplierRoutes.js
│   ├── ticketRoutes.js
│   └── userRoutes.js
├── controllers/             # Logic for route handlers
├── utils/                   # Utility functions
├── uploads/                 # Uploaded documents & files
├── db.js                    # MongoDB connection setup
├── index.js                 # Entry point for Express server
├── .env                     # Environment variables
├── package.json
├── package-lock.json
└── README.md
```

---

## ⚙️ Key Features

* **Client Management** – Create and manage clients with contact history.
* **Inventory Management** – Track and update item stock levels.
* **Quotations** – Generate and manage item quotations.
* **Ticketing System** – Create and track client tickets.
* **Challan System** – Issue challans tied to clients/tickets.
* **Purchase System** – Manage procurement from suppliers.
* **Time Logging** – Track employee hours and activities.
* **Authentication** – Secure login/signup with JWT.

---

## 🚀 Getting Started

### Client

```bash
cd client
npm install      # or yarn install
npm run dev      # or yarn dev
```

### Server

```bash
cd server
npm install      # or yarn install
npm start        # or yarn start
```
## 🔌 API

All APIs follow REST conventions. Refer to route/controller files in `server/routes/` and `server/controllers/` for detailed endpoints.

---

## 🧠 MongoDB Schema Relationship Summary

### Core Entities

* **User** – Central entity owning clients, tickets, items, and logs.
* **Client** – Has multiple quotations and tickets.
* **Supplier** – Provides items, used in purchases.
* **Item** – Part of quotations and purchases.

### Transactional

* **Quotation** → Converts into **Ticket**
* **Ticket** → Can generate **Challan**
* **Purchase** → Updates **Item** stock
* **LogTime** → Tracks time, optionally linked to Ticket

---

## 🧭 Visual Flow Diagram

```
    User
     │
     ├────> Client ─────> Quotation ─────┐
     │                                   ↓
     │                             Ticket 
     │                                   ↑
     ├────> Supplier ─────> Purchase ────┘
     │                                   ↑
     ├────> Item ────────────────────────┘
     │
     └────> LogTime 
```

---

## 🔄 Business Flow Examples

1. **Quotation → Ticket**

   * Create a quotation for a client → Approve → Convert to ticket

2. **Procurement Flow**

   * Record purchase from supplier → Update item stock → Use in quotations.

3. **Time Tracking**

   * Log employee hours → Attach to ticket → Generate monthly reports.

---

## 🤝 Contributing

1. Fork the repo
2. Create a new branch (`git checkout -b feature-name`)
3. Commit your changes
4. Push and create a PR

---

## 📫 Support

For questions or bugs, raise an issue or contact the dev team directly.
