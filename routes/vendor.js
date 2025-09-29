const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const vendorController = require('../controllers/vendorStaffController');

// All routes here require the user to be a Vendor for their specific shop
const vendorAuth = auth('Vendor'); 

/**
 * @route 	GET /api/vendor/staff
 * @desc 	Vendor gets all staff accounts for their shop
 * @access 	Private (Vendor role)
 */
router.get('/staff', vendorAuth, vendorController.getStaff);

/**
 * @route 	PUT /api/vendor/staff/:id/approve
 * @desc 	Vendor approves a staff account
 * @access 	Private (Vendor role)
 */
router.put('/staff/:id/approve', vendorAuth, vendorController.approveStaff);

/**
 * @route 	DELETE /api/vendor/staff/:id
 * @desc 	Vendor deletes a staff account
 * @access 	Private (Vendor role)
 */
router.delete('/staff/:id', vendorAuth, vendorController.deleteStaff);

module.exports = router;