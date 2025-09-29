const Order = require('../models/Order');
const Vendor = require('../models/Vendor'); // Needed to confirm vendor data if necessary (optional here, but good practice)
const User = require('../models/User'); // Needed to confirm server/staff data (optional)
const MenuItem = require('../models/MenuItem'); // Now imported!

// Helper function to calculate total amount (Now uses real price from DB)
const calculateTotalAmount = async (items, vendorId) => {
    let total = 0;
    const itemIds = items.map(item => item.menuItemId);

    // Fetch prices for all items in one query
    const menuItems = await MenuItem.find({ 
        _id: { $in: itemIds }, 
        vendorId 
    }).select('price name _id');
    
    if (menuItems.length !== itemIds.length) {
        // Handle case where some menu items might be invalid/deleted/not for this vendor
        throw new Error('One or more menu items are invalid or unavailable.');
    }

    const priceMap = menuItems.reduce((acc, item) => {
        acc[item._id.toString()] = { price: item.price, name: item.name };
        return acc;
    }, {});

    items.forEach(item => {
        const details = priceMap[item.menuItemId.toString()];
        if (details) {
            total += item.quantity * details.price;
            item.name = details.name; // Denormalize the name for KOT view
        }
    });

    return total;
};


// @desc 	Server creates a new order
// @route 	POST /api/orders
// @access 	Private (Server role required)
exports.createOrder = async (req, res) => {
    const { tableNumber, items } = req.body;
    const vendorId = req.user.vendorId;
    const serverId = req.user.id;

    if (!tableNumber || !items || items.length === 0) {
        return res.status(400).json({ msg: 'Order must include table number and at least one item.' });
    }

    // Basic validation for item structure
    const isValid = items.every(item => item.menuItemId && item.quantity > 0 && item.itemTableNumber);
    if (!isValid) {
        return res.status(400).json({ msg: 'Invalid item data found in the order list.' });
    }

    try {
        // Calculate total amount and denormalize item names
        const totalAmount = await calculateTotalAmount(items, vendorId);

        const newOrder = new Order({
            tableNumber,
            items,
            server: serverId,
            vendorId,
            totalAmount,
            status: 'Kitchen' // Immediately sent to kitchen upon creation by Server
        });

        await newOrder.save();
        res.status(201).json(newOrder);

    } catch (err) {
        console.error(err.message);
        if (err.message.includes('invalid or unavailable')) {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send('Server error during order creation');
    }
};

// @desc    Kitchen gets pending/cooking orders
// @route   GET /api/orders/kitchen
// @access  Private (Kitchen role required)
exports.getKitchenOrders = async (req, res) => {
    const vendorId = req.user.vendorId;

    try {
        // Kitchen sees orders that are 'Pending' (if Server set it) or currently being prepared ('Kitchen')
        const orders = await Order.find({
            vendorId,
            status: { $in: ['Pending', 'Kitchen'] }
        }).sort({ createdAt: 1 }); // Oldest orders first

        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error retrieving kitchen orders');
    }
};

// @desc    Billing gets orders ready for billing
// @route   GET /api/orders/billing
// @access  Private (Billing role required)
exports.getBillingOrders = async (req, res) => {
    const vendorId = req.user.vendorId;

    try {
        // Billing sees orders that are 'Ready' (by kitchen) or 'Served' (by server) but not yet 'Billed'
        const orders = await Order.find({
            vendorId,
            status: { $in: ['Ready', 'Served'] }
        }).sort({ tableNumber: 1, createdAt: 1 }); // Sort by table number

        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error retrieving billing orders');
    }
};

// @desc    Get details of a single order
// @route   GET /api/orders/:id
// @access  Private (Server, Billing, Vendor roles)
exports.getOrderById = async (req, res) => {
    const vendorId = req.user.vendorId;

    try {
        // Must match order ID AND vendor ID for security
        const order = await Order.findOne({
            _id: req.params.id,
            vendorId
        });

        if (!order) {
            return res.status(404).json({ msg: 'Order not found for this shop.' });
        }

        res.json(order);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Order not found.' });
        }
        res.status(500).send('Server error retrieving order details');
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Kitchen, Server, Billing, Vendor roles)
exports.updateStatus = async (req, res) => {
    const { newStatus } = req.body;
    const vendorId = req.user.vendorId;
    const userRole = req.user.role;
    
    // Define which roles are allowed to set which statuses
    const allowedTransitions = {
        Kitchen: ['Ready'], // Kitchen prepares and marks it Ready
        Server: ['Served'], // Server picks up 'Ready' and marks it 'Served'
        Billing: ['Billed', 'Completed'], // Billing handles final states
        Vendor: ['Pending', 'Kitchen', 'Ready', 'Served', 'Billed', 'Completed'] // Vendor can override any state
    };
    
    if (!newStatus || !allowedTransitions[userRole]?.includes(newStatus)) {
        return res.status(400).json({ msg: `Invalid status or role (${userRole}) not authorized to set status to ${newStatus}.` });
    }

    try {
        let order = await Order.findOne({
            _id: req.params.id,
            vendorId
        });

        if (!order) {
            return res.status(404).json({ msg: 'Order not found for this shop.' });
        }
        
        // Prevent setting a status that is chronologically backwards or already final
        if (order.status === 'Completed' || order.status === 'Billed') {
             return res.status(400).json({ msg: `Cannot change status of an already ${order.status} order.` });
        }

        order.status = newStatus;
        await order.save();

        res.json({ msg: `Order status updated to ${newStatus}`, order });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Order not found.' });
        }
        res.status(500).send('Server error during status update');
    }
};
