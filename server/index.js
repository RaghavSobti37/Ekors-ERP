const express = require('express');
const connectDB = require('./db.js');
const cors = require('cors');
const itemModel = require('./models/item.js');
const bcrypt = require('bcryptjs'); // For password hashing

const app = express();
app.use(express.json());
app.use(cors());
connectDB();

// Fetch all registered users (for debugging)
app.get('/', async (req, res) => {
    const response = await itemModel.find();
    return res.json({ items: response });
});

// Register a new user
app.post('/register', async (req, res) => {
    try {
        const { firstname, lastname, email, phone, password } = req.body;

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await itemModel.create({
            firstname,
            lastname,
            email,
            phone,
            password: hashedPassword, // Store hashed password
        });

        res.json(newUser);
    } catch (err) {
        res.status(500).json({ error: 'Error registering user' });
    }
});

// **New Login Route**
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user by email
        const user = await itemModel.findOne({ email });  
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Compare hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        res.json({ message: 'Login successful', user });
    } catch (err) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

app.listen(3000, () => {
    console.log("App is Running on Port 3000");
});
