const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    tableNumber: { type: Number, required: true }, // The table for the entire order
    items: [ // This array handles the order list with addons
        {
            menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
            name: String, // Denormalized for simpler KOT view
            quantity: { type: Number, required: true },
            itemTableNumber: { // Specific table number per item (as requested)
                type: Number, 
                required: true 
            }, 
            addons: [String], 
            notes: String 
        }
    ],
    status: { 
        type: String, 
        enum: ['Pending', 'Kitchen', 'Ready', 'Served', 'Billed', 'Completed'], 
        default: 'Pending' 
    },
    server: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // All orders are scoped to a vendor
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    totalAmount: { type: Number, default: 0 },
    paymentMethod: String,
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);