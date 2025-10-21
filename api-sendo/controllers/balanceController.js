const User = require('../models/userModel');

// @desc    Get user balances
// @route   GET /api/users/:userId/balances
// @access  Public
const getBalances = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user.balances });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update user balances
// @route   PUT /api/users/:userId/balances
// @access  Public
const updateBalances = async (req, res) => {
  try {
    const { balances } = req.body; // Expects an array of balance objects
    if (!Array.isArray(balances)) {
      return res.status(400).json({ success: false, message: 'Balances must be an array' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update balances
    balances.forEach(newBalance => {
      const balance = user.balances.find(b => b.currency === newBalance.currency);
      if (balance) {
        balance.amount = newBalance.amount;
      }
    });

    await user.save();
    res.status(200).json({ success: true, data: user.balances });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getBalances,
  updateBalances,
};
