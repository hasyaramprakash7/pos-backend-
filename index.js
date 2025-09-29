const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db'); // Import the separate DB connection function

// Load environment variables from .env file
dotenv.config();

// Connect Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Allows parsing of application/json requests

// Import Routes
// Assuming your route files are named: auth.js, vendor.js, and order.js
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendor');
const orderRoutes = require('./routes/order');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/orders', orderRoutes); // Mount the new order routes
app.use('/api/menu', require('./routes/menu')); // New Menu/Product Route

// Simple root route
app.get('/', (req, res) => res.send('Restaurant Management System API Running!'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
