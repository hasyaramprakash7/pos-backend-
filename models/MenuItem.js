const mongoose = require('mongoose');

// This model represents a product or dish on the menu
const menuItemSchema = new mongoose.Schema({
    vendorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Vendor', 
        required: true 
    },
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    price: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    description: { 
        type: String, 
        trim: true 
    },
    category: { 
        type: String, 
        required: true 
    },
    images: [{ // Array of image URLs
        type: String, 
        required: true 
    }],
    stock: { // Inventory count
        type: Number, 
        default: 0 
    },
    isAvailable: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

// Ensure name is unique per vendor
menuItemSchema.index({ vendorId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);