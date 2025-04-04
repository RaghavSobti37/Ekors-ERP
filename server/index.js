const express = require('express');
const connectDB = require('./db.js');
const cors = require('cors');
const itemModel = require('./models/item.js');
const bcrypt = require('bcryptjs');
const OpenticketModel = require('./models/opentickets.js');
const multer = require('multer');
const path = require('path');
const quotationRoutes = require('./routes/quotations.js');

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type']
}));
connectDB();

// Routes
app.get('/', async (req, res) => {
    try {
        const response = await itemModel.find();
        return res.json({ items: response });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { firstname, lastname, email, phone, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await itemModel.create({
            firstname,
            lastname,
            email,
            phone,
            password: hashedPassword,
        });

        res.status(201).json(newUser);
    } catch (err) {
        res.status(500).json({ error: 'Error registering user' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await itemModel.findOne({ email });  
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        res.json({ message: 'Login successful', user });
    } catch (err) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Quotation routes
app.use('/api', quotationRoutes);

// Ticket routes
app.get('/tickets', async (req, res) => {
    try {
        const tickets = await OpenticketModel.find().sort({ createdAt: -1 });
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching tickets' });
    }
});

app.post('/create-ticket', async (req, res) => {
    try {
        const { companyName, quotationNumber, billingAddress, shippingAddress, goods } = req.body;

        const totalQuantity = goods.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = goods.reduce((sum, item) => sum + item.amount, 0);
        const gstAmount = totalAmount * 0.18;
        const grandTotal = totalAmount + gstAmount;

        const newTicket = await OpenticketModel.create({
            companyName,
            quotationNumber,
            billingAddress,
            shippingAddress,
            goods,
            totalQuantity,
            totalAmount,
            gstAmount,
            grandTotal,
            status: "Quotation Sent"
        });

        res.status(201).json(newTicket);
    } catch (err) {
        res.status(500).json({ error: 'Error creating ticket' });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});