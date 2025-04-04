const express = require('express');
const connectDB = require('./db.js');
const cors = require('cors');
const itemModel = require('./models/item.js');
const bcrypt = require('bcryptjs');
const OpenticketModel = require('./models/opentickets.js');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
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

        // Calculate totals
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
            status: "Quotation Sent",
            statusHistory: [{
                status: "Quotation Sent",
                changedAt: new Date()
            }],
            documents: {
                quotation: "",
                po: "",
                pi: "",
                challan: "",
                packingList: "",
                feedback: ""
            }
        });

        res.status(201).json(newTicket);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating ticket', details: err.message });
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

app.post('/tickets/:id/documents', upload.single('document'), async (req, res) => {
    try {
        const { documentType } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const update = {};
        update[`documents.${documentType}`] = req.file.path.replace(/\\/g, '/');

        const updatedTicket = await OpenticketModel.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        );

        if (!updatedTicket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(updatedTicket);
    } catch (err) {
        res.status(500).json({ error: 'Error uploading document' });
    }
});

// In your backend (index.js or ticket routes)
app.put('/tickets/:id', async (req, res) => {
  try {
    const { _id, __v, createdAt, updatedAt, ...updateData } = req.body;
    
    const updatedTicket = await OpenticketModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true } // Return updated doc and run validators
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(updatedTicket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: 'Error updating ticket',
      message: err.message 
    });
  }
});

const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});