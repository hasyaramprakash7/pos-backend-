const User = require('../models/User');

// All staff management is strictly filtered by the logged-in user's vendorId

// @desc 	Vendor gets all staff accounts for their restaurant
// @route 	GET /api/vendor/staff
// @access 	Private (Vendor role)
exports.getStaff = async (req, res) => {
    try {
        // Filter: Staff must belong to the logged-in vendor's shop
        const staff = await User.find({ 
            vendorId: req.user.vendorId, 
            role: { $ne: 'Vendor' } // Exclude the Vendor owner account
        }).select('-password'); 

        res.json(staff);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc 	Vendor approves a staff account
// @route 	PUT /api/vendor/staff/:id/approve
// @access 	Private (Vendor role)
exports.approveStaff = async (req, res) => {
    try {
        let user = await User.findById(req.params.id);

        // Check 1: User exists, is not a Vendor, and belongs to the current Vendor's shop
        if (!user || user.role === 'Vendor' || user.vendorId.toString() !== req.user.vendorId.toString()) {
            return res.status(404).json({ msg: 'Staff account not found or unauthorized for this vendor.' });
        }

        if (user.isApproved) {
             return res.status(400).json({ msg: 'Staff account is already approved.' });
        }

        user.isApproved = true;
        await user.save();
        
        res.json({ msg: `${user.username} approved successfully. They can now log in.`, user: { id: user.id, isApproved: user.isApproved } });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc 	Vendor deletes a staff account
// @route 	DELETE /api/vendor/staff/:id
// @access 	Private (Vendor role)
exports.deleteStaff = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        // Check 1: User exists, is not a Vendor, and belongs to the current Vendor's shop
        if (!user || user.role === 'Vendor' || user.vendorId.toString() !== req.user.vendorId.toString()) {
            return res.status(404).json({ msg: 'Staff account not found or unauthorized for this vendor.' });
        }

        await User.findByIdAndDelete(req.params.id);

        res.json({ msg: `Staff account ${user.username} deleted successfully.` });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};