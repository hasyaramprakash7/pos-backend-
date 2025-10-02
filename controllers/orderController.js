const Order = require('../models/Order');
const Vendor = require('../models/Vendor'); 
const User = require('../models/User'); 
const MenuItem = require('../models/MenuItem');

// Helper function to calculate total amount (Uses real price from DB)
const calculateTotalAmount = async (items, vendorId) => {
    let total = 0;
    const itemIds = items.map(item => item.menuItemId);

    // Fetch prices and names for all items in one query
    const menuItems = await MenuItem.find({ 
        _id: { $in: itemIds }, 
        vendorId 
    }).select('price name _id');
    
    if (menuItems.length !== itemIds.length) {
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
            item.name = details.name; // Denormalize the name into the order item for KOT/Billing view
        }
    });

    return total;
};


// @desc    Server creates a new order
// @route   POST /api/orders
// @access  Private (Server, Vendor role required)
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
        const totalAmount = await calculateTotalAmount(items, vendorId);

        const newOrder = new Order({
            tableNumber,
            items,
            server: serverId,
            vendorId,
            totalAmount,
            status: 'Kitchen' // Immediately sent to kitchen upon creation
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

// @desc    Add new items to an existing order (KOT Add-on)
// @route   PUT /api/orders/:id/items
// @access  Private (Server role required)
exports.addItemsToOrder = async (req, res) => {
    const { newItems } = req.body;
    const orderId = req.params.id;
    const vendorId = req.user.vendorId;

    if (!newItems || newItems.length === 0) {
        return res.status(400).json({ msg: 'Must include at least one new item to add.' });
    }

    // Basic validation for item structure
    const isValid = newItems.every(item => item.menuItemId && item.quantity > 0 && item.itemTableNumber);
    if (!isValid) {
        return res.status(400).json({ msg: 'Invalid item data found in the new items list.' });
    }
    
    try {
        let order = await Order.findOne({
            _id: orderId,
            vendorId
        });

        if (!order) {
            return res.status(404).json({ msg: 'Order not found for this shop.' });
        }

        // Prevent modifying completed orders
        if (order.status === 'Completed' || order.status === 'Billed') {
            return res.status(400).json({ msg: `Cannot add items to an already ${order.status} order.` });
        }

        // Calculate price and denormalize names for NEW items
        let newItemsTotal = await calculateTotalAmount(newItems, vendorId);

        // Append new items and update total
        order.items.push(...newItems);
        order.totalAmount += newItemsTotal;

        // Reset status to 'Kitchen' to notify kitchen staff of the add-on
        if (order.status !== 'Kitchen' && order.status !== 'Pending') {
             order.status = 'Kitchen'; 
        }

        await order.save();

        res.json({ 
            msg: `Successfully added ${newItems.length} items to the order. Total updated.`, 
            order 
        });

    } catch (err) {
        console.error(err.message);
        if (err.message.includes('invalid or unavailable')) {
            return res.status(400).json({ msg: err.message });
        }
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Order not found.' });
        }
        res.status(500).send('Server error during add-on operation');
    }
};

// @desc    Kitchen gets pending/cooking orders
// @route   GET /api/orders/kitchen
// @access  Private (Kitchen role required)
exports.getKitchenOrders = async (req, res) => {
    const vendorId = req.user.vendorId;

    try {
        const orders = await Order.find({
            vendorId,
            status: { $in: ['Pending', 'Kitchen'] }
        }).sort({ createdAt: 1 }); 

        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error retrieving kitchen orders');
    }
};

// @desc    Billing/Server gets active orders ready for billing/serving
// @route   GET /api/orders/billing
// @access  Private (Billing, Server role required)
exports.getBillingOrders = async (req, res) => {
    const vendorId = req.user.vendorId;

    try {
        // 🚨 CRITICAL FIX: EXCLUDE 'Billed' orders to prevent phantom orders on the table selection screen.
        const orders = await Order.find({
            vendorId,
            status: { $in: ['Ready', 'Served', 'Completed'] } 
        }).sort({ tableNumber: 1, createdAt: 1 }); 

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
        Kitchen: ['Ready'], 
        Server: ['Served'], 
        Billing: ['Billed', 'Completed'], 
        Vendor: ['Pending', 'Kitchen', 'Ready', 'Served', 'Billed', 'Completed'] 
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
        // NOTE: Vendor is allowed to reset status backwards for correction, but staff are not.
        if (order.status === 'Completed' && userRole !== 'Vendor') {
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

// @desc    Vendor/Management gets completed (billed/closed) orders
// @route   GET /api/orders/completed
// @access  Private (Vendor role required)
exports.getCompletedOrders = async (req, res) => {
    const vendorId = req.user.vendorId;
    
    // Optional: Allow filtering by date range for better performance/usability
    const { startDate, endDate } = req.query; 

    try {
        const query = {
            vendorId,
            // CORRECT: This correctly includes both Billed and Completed for reporting
            status: { $in: ['Billed', 'Completed'] } 
        };

        // Apply date filtering
        if (startDate && endDate) {
            // Note: Ensuring endDate includes the whole day
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999); 

            query.updatedAt = {
                $gte: new Date(startDate),
                $lte: endOfDay
            };
        }
        
        // Populate server details (optional, but useful for reports)
        const orders = await Order.find(query)
            .sort({ updatedAt: -1 }); 
            
        
        // Optional: Calculate total sales amount for the fetched orders
        const totalSales = orders.reduce((acc, order) => acc + order.totalAmount, 0);

        res.json({
            count: orders.length,
            totalSales: totalSales.toFixed(2),
            orders: orders
        });
    } catch (err) { 
        console.error(err.message);
        res.status(500).send('Server error retrieving completed orders');
    }
};