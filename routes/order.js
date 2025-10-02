const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Assuming this is your main authentication middleware
const OrderController = require('../controllers/orderController');

// NOTE: I am assuming your auth middleware accepts an array of roles for checking.

// ==========================================================
// 1. SPECIFIC STATIC ROUTES MUST COME FIRST (e.g., /kitchen, /completed)
// ==========================================================

/**
 * @route   GET api/orders/kitchen
 * @desc    Kitchen gets pending/cooking orders
 * @access  Private (Kitchen, Vendor role required)
 */
router.get('/kitchen', auth(['Kitchen', 'Vendor']), OrderController.getKitchenOrders);

/**
 * @route   GET api/orders/billing
 * @desc    Billing gets orders ready for billing
 * @access  Private (Billing, Vendor, Server roles required)
 */
router.get('/billing', auth(['Billing', 'Vendor', 'Server']), OrderController.getBillingOrders);

/**
 * @route   GET api/orders/completed
 * @desc    Vendor/Management gets completed (billed/closed) orders for sales/analytics
 * @access  Private (Vendor, Billing role required)
 * NOTE: I've added 'Billing' here as they are also often authorized to view reports.
 */
router.get('/completed', auth(['Vendor', 'Billing']), OrderController.getCompletedOrders);

// ==========================================================
// 2. GENERIC ROUTES AND POST/PUT (WHICH DON'T CLASH WITH STATIC PATHS)
// ==========================================================

/**
 * @route   POST api/orders
 * @desc    Server creates a new order
 * @access  Private (Server, Vendor role required)
 */
router.post('/', auth(['Server', 'Vendor']), OrderController.createOrder);


/**
 * @route   GET api/orders/:id
 * @desc    Get details of a single order
 * @access  Private (Server, Billing, Vendor roles)
 */
router.get('/:id', auth(['Server', 'Billing', 'Vendor']), OrderController.getOrderById);

/**
 * @route   PUT api/orders/:id/items
 * @desc    Add new items to an existing order (KOT Add-on)
 * @access  Private (Server, Vendor roles required)
 */
router.put('/:id/items', auth(['Server', 'Vendor']), OrderController.addItemsToOrder);


/**
 * @route   PUT api/orders/:id/status
 * @desc    Update order status
 * @access  Private (Kitchen, Server, Billing, Vendor roles)
 */
router.put('/:id/status', auth(['Kitchen', 'Server', 'Billing', 'Vendor']), OrderController.updateStatus);

module.exports = router;