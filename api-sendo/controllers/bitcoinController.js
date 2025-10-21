const User = require('../models/userModel');
const { deriveBitcoinAddress } = require('../services/nearService');

// @desc    Create and register a Bitcoin account for a user
// @route   POST /api/users/:userId/bitcoin-account
// @access  Public
const createBitcoinAccount = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.bitcoinAddress) {
      return res.status(400).json({ success: false, message: 'User already has a Bitcoin account registered' });
    }

    // Sanitize phone number to ensure it's a valid path component
    const sanitizedPhoneNumber = user.phoneNumber.replace(/[^0-9]/g, '');
    const derivationPath = `btc-${sanitizedPhoneNumber}`;
    
    const bitcoinAddress = await deriveBitcoinAddress(derivationPath);

    user.bitcoinAddress = bitcoinAddress;
    await user.save();

    res.status(200).json({ success: true, data: user });

  } catch (error) {
    console.error('Error creating Bitcoin account:', error);
    res.status(500).json({ success: false, message: 'Failed to create Bitcoin account', error: error.message });
  }
};

module.exports = {
  createBitcoinAccount,
};

