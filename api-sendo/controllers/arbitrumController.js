const User = require('../models/userModel');
const { deriveArbitrumAddress } = require('../services/nearService');

// @desc    Create and register an Arbitrum account for a user
// @route   POST /api/users/:userId/arbitrum-account
// @access  Public
const createArbitrumAccount = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.arbitrumAddress) {
      return res.status(400).json({ success: false, message: 'User already has an Arbitrum account registered' });
    }

    // Sanitize phone number to ensure it's a valid path component
    const sanitizedPhoneNumber = user.phoneNumber.replace(/[^0-9]/g, '');
    const derivationPath = `arb-${sanitizedPhoneNumber}`;
    
    const arbitrumAddress = await deriveArbitrumAddress(derivationPath);

    user.arbitrumAddress = arbitrumAddress;
    await user.save();

    res.status(200).json({ success: true, data: user });

  } catch (error) {
    console.error('Error creating Arbitrum account:', error);
    res.status(500).json({ success: false, message: 'Failed to create Arbitrum account', error: error.message });
  }
};

module.exports = {
  createArbitrumAccount,
};
