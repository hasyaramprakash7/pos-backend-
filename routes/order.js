const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const OrderController = require('../controllers/orderController');

/**
 * @route   POST api/orders
 * @desc    Server creates a new order
 * @access  Private (Server, Vendor, Kitchen, or Billing role required)
 */
// 📢 FIX: Added Kitchen and Billing roles to allow order creation
router.post('/', auth(['Server', 'Vendor', 'Kitchen', 'Billing']), OrderController.createOrder);

/**
 * @route   GET api/orders/kitchen
 * @desc    Kitchen gets pending/cooking orders (scoped by vendorId)
 * @access  Private (Kitchen OR Vendor role required)
 */
router.get('/kitchen', auth(['Kitchen', 'Vendor']), OrderController.getKitchenOrders);

/**
 * @route   GET api/orders/billing
 * @desc    Billing gets orders ready for billing (scoped by vendorId)
 * @access  Private (Billing, Vendor, Server, Kitchen roles required)
 */
router.get('/billing', auth(['Billing', 'Vendor', 'Server', 'Kitchen']), OrderController.getBillingOrders);

/**
 * @route   GET api/orders/:id
 * @desc    Get details of a single order (scoped by vendorId)
 * @access  Private (Server, Billing, Vendor roles)
 */
router.get('/:id', auth(['Server', 'Billing', 'Vendor']), OrderController.getOrderById);

/**
 * @route   PUT api/orders/:id/status
 * @desc    Update order status (scoped by vendorId and role)
 * @access  Private (Kitchen, Server, Billing, Vendor roles)
 */
router.put('/:id/status', auth(['Kitchen', 'Server', 'Billing', 'Vendor']), OrderController.updateStatus);

module.exports = router;
// ```

// ### Summary of Change:

// The line defining access for order creation has changed to include all primary staff roles:

// ```javascript
// router.post('/', auth(['Server', 'Vendor', 'Kitchen', 'Billing']), OrderController.createOrder);
