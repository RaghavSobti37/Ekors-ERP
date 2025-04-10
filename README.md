# ERP System Documentation

## Overview
This ERP (Enterprise Resource Planning) system is a comprehensive solution designed to manage various business operations including client management, inventory, quotations, ticketing, and time logging. The system consists of a React-based frontend (client) and a Node.js backend (server).

## File Structure

### Client Side
```
client/
├── node_modules/          # Project dependencies
├── public/                # Static assets
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable UI components
│   ├── css/               # Stylesheets
│   ├── templates/         # Template files
│   ├── App.jsx            # Main application component
│   ├── Challan.jsx        # Challan management component
│   ├── History.jsx        # History tracking component
│   ├── Itemslist.jsx      # Inventory management component
│   ├── Login.jsx          # Authentication component
│   ├── Logtime.jsx        # Time logging component
│   ├── main.jsx          # Application entry point
│   ├── Quotations.jsx     # Quotation management component
│   ├── Signup.jsx         # User registration component
│   └── Tickets.jsx        # Ticket management component
├── .gitignore             # Git ignore rules
├── eslint.config.js       # ESLint configuration
├── index.html             # Main HTML file
├── package-lock.json      # NPM dependency tree
├── package.json           # Project metadata and scripts
├── README.md              # Client documentation
├── vite.config.js         # Vite configuration
└── yarn.lock              # Yarn dependency tree
```

### Server Side
```
server/
├── middleware/            # Express middleware
├── models/                # Database models
│   ├── client.js          # Client model
│   ├── item.js            # Login model
│   ├── itemlist.js        # Item list model
│   ├── LogTime.js         # Time logging model
│   ├── opentickets.js     # Ticket model
│   └── quotation.js       # Quotation model
├── node_modules/          # Project dependencies
├── routes/                # API routes
│   ├── itemlistRoutes.js  # Item list routes
│   ├── logTimeRoutes.js   # Time logging routes
│   ├── quotations.js      # Quotation routes
│   └── ticketRoutes.js    # Ticket routes
├── uploads/               # File uploads directory
├── db.js                  # Database connection
├── index.js               # Server entry point
├── package-lock.json      # NPM dependency tree
├── package.json           # Project metadata and scripts
├── yarn.lock              # Yarn dependency tree
└── README.md              # Server documentation
```

## Key Features

1. **Client Management**
   - Create and manage client records
   - Track client interactions and history

2. **Inventory Management**
   - Maintain item lists and stock levels
   - Generate challans for items

3. **Quotation System**
   - Create and manage price quotations
   - Track quotation history

4. **Ticketing System**
   - Create and manage support tickets
   - Track open tickets and resolutions

5. **Time Logging**
   - Record and manage employee work hours
   - Generate time reports

6. **Authentication**
   - Secure login and signup functionality
   - User session management

## Installation

### Client
1. Navigate to the client directory: `cd client`
2. Install dependencies: `npm install` or `yarn install`
3. Start development server: `npm run dev` or `yarn dev`

### Server
1. Navigate to the server directory: `cd server`
2. Install dependencies: `npm install` or `yarn install`
3. Start the server: `npm start` or `yarn start`

## Configuration

1. Create a `.env` file in the server directory with your database credentials:
   ```
   DB_HOST=your_database_host
   DB_USER=your_database_user
   DB_PASS=your_database_password
   DB_NAME=your_database_name
   JWT_SECRET=your_jwt_secret_key
   ```

## API Documentation

The server provides RESTful API endpoints for all major functionalities. Refer to the individual route files in `server/routes/` for detailed endpoint documentation.

## Contributing

1. Fork the repository
2. Create a new branch for your feature
3. Commit your changes
4. Push to the branch
5. Create a pull request

## Support

For any issues or questions, please open an issue in the repository or contact the development team.
