const User = require('../models/User');
const Vendor = require('../models/Vendor');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// NOTE: In a real application, ensure process.env.JWT_SECRET is set up.
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'your_super_secret_jwt_key_for_development'; 
}

// Helper to generate JWT
const generateToken = (user, res) => {
    const payload = { 
        user: { 
            id: user.id, 
            role: user.role, 
            isApproved: user.isApproved,
            vendorId: user.vendorId 
        } 
    };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
        if (err) throw err;
        // Respond with token and core user data
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                role: user.role, 
                isApproved: user.isApproved, 
                vendorId: user.vendorId 
            } 
        });
    });
};

// @desc    Register a new user (Vendor or staff)
// @route   POST /api/auth/register
exports.register = async (req, res) => {
    const { 
        username, password, role, email, phoneNumber, 
        gstNumber, foodLicenseNumber, shopName,
        vendorId // Staff must provide the Vendor ID they are joining
    } = req.body;

    try {
        if (!username || !password || !role || !email || !phoneNumber) {
            return res.status(400).json({ msg: 'Missing required common fields.' });
        }
        
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        let finalVendorId = null;
        let isApproved = false;
        let finalGstNumber = undefined;
        let finalFoodLicenseNumber = undefined;

        if (role === 'Vendor') {
            // --- VENDOR REGISTRATION ---
            // 1. Create the shop entity first
            if (!gstNumber || !foodLicenseNumber || !shopName) {
                return res.status(400).json({ msg: 'Vendor must provide Shop Name, GST Number, and Food License Number.' });
            }
            
            // Generate a temporary user ID (ObjectId) for linking the Vendor document
            const tempUserId = new mongoose.Types.ObjectId();

            // Create the Vendor entity (shop)
            const newVendor = new Vendor({ 
                name: shopName, 
                gstNumber, 
                foodLicenseNumber,
                ownerUser: tempUserId // Link the temporary User ID
            });
            await newVendor.save();
            
            finalVendorId = newVendor._id; // Use the newly created Vendor's ID
            isApproved = true; // Vendor is automatically approved
            finalGstNumber = gstNumber;
            finalFoodLicenseNumber = foodLicenseNumber;
            
            // Create the User, explicitly using the temporary ID and setting vendor details
            user = new User({ 
                _id: tempUserId, 
                username, password: hashedPassword, email, phoneNumber, 
                gstNumber: finalGstNumber, foodLicenseNumber: finalFoodLicenseNumber, 
                role, 
                vendorId: finalVendorId, 
                isApproved 
            });


        } else {
            // --- STAFF REGISTRATION ---
            // 1. Must provide the Vendor ID
            if (!vendorId) {
                return res.status(400).json({ msg: 'Staff must provide a Vendor ID to join a shop.' });
            }
            // 2. Validate the Vendor ID
            const existingVendor = await Vendor.findById(vendorId);
            if (!existingVendor) {
                return res.status(400).json({ msg: 'Invalid Vendor ID provided. Please check with your Vendor/Owner.' });
            }
            
            finalVendorId = vendorId;
            isApproved = false; // Staff starts as pending approval
            
            // Create the staff user, linked to the Vendor ID
            user = new User({ 
                username, password: hashedPassword, email, phoneNumber, 
                role, 
                vendorId: finalVendorId, 
                isApproved 
            });
        }

        await user.save();
        
        if (user.role === 'Vendor') {
            // Vendors log in immediately
            generateToken(user, res);
        } else {
            // Staff wait for approval
            res.status(201).json({ 
                msg: `Account created for role: ${role}. Waiting for Vendor approval for shop ID: ${finalVendorId}. You will be able to log in once approved.` 
            });
        }

    } catch (err) {
        console.error(err.message); 
        if (err.code === 11000) { 
            const field = Object.keys(err.keyPattern)[0];
            return res.status(400).json({ msg: `${field} is already in use.` });
        }
        res.status(500).send('Server error');
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        let user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // CRITICAL CHECK: Staff accounts must be approved by the Vendor
        if (user.role !== 'Vendor' && !user.isApproved) {
            return res.status(403).json({ msg: 'Your account is pending Vendor approval. Please contact your shop owner.' });
        }

        generateToken(user, res);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
