const MenuItem = require('../models/MenuItem');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary'); 
const streamifier = require('streamifier');

// Helper: Validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Cloudinary Upload Helper (Defined here for the controller to use) ---
const uploadToCloudinary = (buffer) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((err, result) => {
            if (result) {
                console.log("Image uploaded to Cloudinary:", result.secure_url);
                resolve(result.secure_url);
            } else {
                console.error("Cloudinary upload error:", err);
                reject(err);
            }
        });
        streamifier.createReadStream(buffer).pipe(stream);
    });

// Define roles that are PERMITTED to view/manage the menu
// Vendor/Staff roles who can access the menu interface
const MENU_ACCESS_ROLES = ['Vendor', 'Server', 'Kitchen', 'Billing']; 
// Roles permitted to CREATE/UPDATE/DELETE items (usually more restricted)
const MENU_MANAGEMENT_ROLES = ['Vendor', 'Kitchen']; 


// Helper function to check role and approval status
const checkMenuAccess = (req, res, allowedRoles = MENU_ACCESS_ROLES) => {
    const vendorId = req.user?.vendorId;
    const userRole = req.user?.role;
    const isApproved = req.user?.isApproved;
    
    if (!vendorId) {
        return res.status(403).json({ success: false, msg: 'Vendor/Staff must be linked to a Vendor entity.' });
    }

    // 1. Check for approved role (Role-based access)
    if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
            success: false, 
            msg: `Role '${userRole}' is unauthorized for this action.` 
        });
    }

    // 2. Check for staff approval status (Approval-based access)
    // Vendor is always considered approved. This mainly applies to staff roles.
    if (userRole !== 'Vendor' && !isApproved) {
        return res.status(403).json({ 
            success: false, 
            msg: 'Your account is pending approval by the Vendor owner.' 
        });
    }

    return true; // Access granted
};

// @desc    Vendor creates a new menu item
// @route   POST /api/menu
// @access  Private (Vendor/Kitchen roles)
exports.createMenuItem = async (req, res) => {
    // 📢 Enforce role and approval checks before processing
    const accessCheck = checkMenuAccess(req, res, MENU_MANAGEMENT_ROLES);
    if (accessCheck !== true) return accessCheck;
    
    const vendorId = req.user?.vendorId;

    try {
        const {
            name, price, description, category, stock, isAvailable
        } = req.body;

        if (!name || !price || !category) {
            return res.status(400).json({ success: false, msg: 'Missing required fields: name, price, and category.' });
        }

        // 1. Handle Image Uploads
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const url = await uploadToCloudinary(file.buffer);
                imageUrls.push(url);
            }
        }
        
        // 2. Prepare Data and Parse Numbers/Booleans
        const parsedPrice = parseFloat(price);
        // Use unary plus operator for concise number parsing if you're sure about the string format
        const parsedStock = stock ? parseInt(stock, 10) : undefined; 
        // Convert 'true'/'false' string from form-data to boolean
        const parsedIsAvailable = typeof isAvailable === 'string' ? (isAvailable === 'true') : isAvailable;

        const newItem = new MenuItem({
            vendorId,
            name,
            price: parsedPrice,
            description,
            category,
            images: imageUrls, 
            stock: parsedStock,
            isAvailable: parsedIsAvailable,
        });

        const savedItem = await newItem.save();
        res.status(201).json({ success: true, item: savedItem, message: "Menu item created successfully." });

    } catch (err) {
        console.error("Create Menu Item Error:", err.message);
        if (err.code === 11000) { 
            return res.status(400).json({ success: false, msg: 'Menu Item name already exists for this vendor.' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, msg: err.message });
        }
        res.status(500).json({ success: false, msg: 'Server error during menu item creation' });
    }
};

// @desc    Get all menu items for the vendor
// @route   GET /api/menu
// @access  Private (All Approved Vendor/Staff roles: Vendor, Server, Kitchen, Billing)
exports.getMenuItems = async (req, res) => {
    // 📢 Enforce role and approval checks before processing
    const accessCheck = checkMenuAccess(req, res, MENU_ACCESS_ROLES);
    if (accessCheck !== true) return accessCheck;
    
    const vendorId = req.user?.vendorId; 

    try {
        // 3. Fetch items ONLY for the authenticated vendorId (Ownership check)
        const items = await MenuItem.find({ vendorId }).sort({ category: 1, name: 1 });
        res.json({ success: true, items });

    } catch (err) {
        console.error("Get Menu Items Error:", err.message);
        res.status(500).json({ success: false, msg: 'Server error retrieving menu items' });
    }
};

// @desc    Update a menu item
// @route   PUT /api/menu/:id
// @access  Private (Vendor/Kitchen roles)
exports.updateMenuItem = async (req, res) => {
    // 📢 Enforce role and approval checks before processing
    const accessCheck = checkMenuAccess(req, res, MENU_MANAGEMENT_ROLES);
    if (accessCheck !== true) return accessCheck;

    const vendorId = req.user?.vendorId;
    const { id } = req.params;
    let updates = req.body;

    try {
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, msg: 'Invalid menu item ID.' });
        }

        // 1. Handle Numeric/Boolean Fields from string
        if (updates.price) updates.price = parseFloat(updates.price);
        if (updates.stock) updates.stock = parseInt(updates.stock, 10);
        if (typeof updates.isAvailable === 'string') updates.isAvailable = (updates.isAvailable === 'true');

        // 2. Handle Image Uploads (Replace existing images if new files are provided)
        if (req.files && req.files.length > 0) {
            const newImageUrls = [];
            for (const file of req.files) {
                const url = await uploadToCloudinary(file.buffer);
                newImageUrls.push(url);
            }
            updates.images = newImageUrls;
        }

        // 3. Find and Update the item, ensuring vendor ownership
        const item = await MenuItem.findOneAndUpdate(
            { _id: id, vendorId }, // CRITICAL: Filter by both _id and vendorId
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!item) {
            return res.status(404).json({ success: false, msg: 'Menu item not found or unauthorized to update.' });
        }

        res.json({ success: true, item, message: "Menu item updated successfully." });

    } catch (err) {
        console.error("Update Menu Item Error:", err.message);
        if (err.code === 11000) { 
            return res.status(400).json({ success: false, msg: 'Menu Item name already exists for this vendor.' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, msg: err.message });
        }
        res.status(500).json({ success: false, msg: 'Server error during menu item update' });
    }
};

// @desc    Delete a menu item
// @route   DELETE /api/menu/:id
// @access  Private (Vendor/Kitchen roles)
exports.deleteMenuItem = async (req, res) => {
    // 📢 Enforce role and approval checks before processing
    const accessCheck = checkMenuAccess(req, res, MENU_MANAGEMENT_ROLES);
    if (accessCheck !== true) return accessCheck;

    const vendorId = req.user?.vendorId;
    const { id } = req.params;

    try {
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, msg: 'Invalid menu item ID.' });
        }
        
        const item = await MenuItem.findOneAndDelete({ 
            _id: id, 
            vendorId // CRITICAL: Ensure only the item belonging to this vendor is deleted
        });

        if (!item) {
            return res.status(404).json({ success: false, msg: 'Menu item not found or unauthorized to delete.' });
        }

        res.json({ success: true, msg: `Menu item ${item.name} deleted successfully.` });
    } catch (err) {
        console.error("Delete Menu Item Error:", err.message);
        res.status(500).json({ success: false, msg: 'Server error during menu item deletion' });
    }
};