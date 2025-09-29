const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        // Basic regex for email validation
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    phoneNumber: {
        type: String,
        required: true,
        // Basic regex for 10-digit phone number
        match: [/^\d{10}$/, 'Please fill a valid 10-digit phone number']
    },
    role: { 
        type: String, 
        enum: ['Vendor', 'Server', 'Kitchen', 'Billing'], 
        required: true 
    },
    // Conditional fields are required on the User model during registration for Vendor role
    gstNumber: {
        type: String,
        required: function() { return this.role === 'Vendor'; },
        unique: function() { return this.role === 'Vendor'; },
        sparse: true // Allows non-Vendors to skip the unique constraint
    },
    foodLicenseNumber: {
        type: String,
        required: function() { return this.role === 'Vendor'; },
        unique: function() { return this.role === 'Vendor'; },
        sparse: true
    },
    // vendorId links all staff and data to a specific Vendor entity (shop)
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    isApproved: { type: Boolean, default: false } // Staff approval flag, true for Vendor owner
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);