const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth"); // Base 'auth' function for middleware
const menuController = require("../controllers/menuItemController"); 

const router = express.Router();

// --- Multer Configuration ---
const storage = multer.memoryStorage();
// Configure Multer to handle an array of files, max 5 images
const upload = multer({ storage }).array("images", 5);

// --- Middleware Helpers (Based on your auth function) ---
const isVendor = auth('Vendor'); 
const isStaff = auth(['Server', 'Kitchen', 'Billing']);
const isVendorOrStaff = auth(['Vendor', 'Server', 'Kitchen', 'Billing']);
// Note: We use 'auth()' for general login check

// --- ROUTES ---

// POST /api/menu (CREATE)
// Only VENDORS can create new menu items.
router.post(
    '/',
    auth(),             // 1. Check if user is logged in
    isVendor,           // 2. Restrict to 'Vendor' role
    upload,             
    menuController.createMenuItem 
);

// GET /api/menu (READ - Vendor's items)
// All authenticated users can see the menu items (Vendor & Staff roles).
router.get(
    '/', 
    auth(),             // Only requires a valid token (logged-in user)
    isVendorOrStaff,    // Restrict only to users with Vendor/Staff roles
    menuController.getMenuItems 
);

// PUT /api/menu/:id (UPDATE)
// Only VENDORS and KITCHEN staff can update menu items (e.g., set out of stock).
router.put(
    '/:id',
    auth(),
    auth(['Vendor', 'Kitchen']), // Allow Vendor OR Kitchen role
    upload, 
    menuController.updateMenuItem 
);

// DELETE /api/menu/:id
// Only VENDORS can delete menu items (high permission).
router.delete(
    '/:id', 
    auth(),
    isVendor, // Restrict to 'Vendor' role
    menuController.deleteMenuItem 
);

module.exports = router;