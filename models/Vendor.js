const mongoose = require('mongoose');

// This model represents the physical restaurant/shop entity
// It holds the business registration details.
const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    gstNumber: { type: String, required: true, unique: true },
    foodLicenseNumber: { type: String, required: true, unique: true },
    // Reference to the User who created and controls this Vendor entity
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true } 
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);