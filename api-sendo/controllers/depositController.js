const User = require('../models/userModel');

// @desc    Get deposit information for a user
// @route   GET /api/users/:userId/deposit
// @access  Public
const getDepositInfo = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById({phoneNumber:userId});

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prepare deposit information for each supported asset
    const depositInfo = {
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
      },
      deposits: []
    };

    // Bitcoin deposits
    if (user.bitcoinAddress) {
      depositInfo.deposits.push({
        asset: 'BTC',
        network: 'Bitcoin Mainnet',
        address: user.bitcoinAddress,
        minimumDeposit: '0.00001 BTC',
        confirmations: 3,
        instructions: 'Send Bitcoin to this address. Funds will be credited after 3 confirmations.',
        qrCode: `bitcoin:${user.bitcoinAddress}`, // For QR code generation
      });
    } else {
      depositInfo.deposits.push({
        asset: 'BTC',
        network: 'Bitcoin Mainnet',
        address: null,
        message: 'Bitcoin address not generated yet. Please create a Bitcoin account first.',
        endpoint: `/api/users/${userId}/bitcoin-account`
      });
    }

    // PYUSD on Arbitrum
    if (user.arbitrumAddress) {
      depositInfo.deposits.push({
        asset: 'PYUSD',
        network: 'Arbitrum One',
        contractAddress: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8', // PYUSD on Arbitrum
        address: user.arbitrumAddress,
        minimumDeposit: '1 PYUSD',
        confirmations: 12,
        instructions: 'Send PYUSD tokens to this Arbitrum address. Ensure you are on Arbitrum One network.',
        qrCode: `ethereum:${user.arbitrumAddress}?token=0x6c3ea9036406852006290770BEdFcAbA0e23A0e8`,
        warning: '⚠️ Only send PYUSD tokens on Arbitrum One. Sending from other networks will result in loss of funds.'
      });
    } else {
      depositInfo.deposits.push({
        asset: 'PYUSD',
        network: 'Arbitrum One',
        address: null,
        message: 'Arbitrum address not generated yet. Please create an Arbitrum account first.',
        endpoint: `/api/users/${userId}/arbitrum-account`
      });
    }

    // USDT on Arbitrum
    if (user.arbitrumAddress) {
      depositInfo.deposits.push({
        asset: 'USDT',
        network: 'Arbitrum One',
        contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT on Arbitrum
        address: user.arbitrumAddress,
        minimumDeposit: '1 USDT',
        confirmations: 12,
        instructions: 'Send USDT tokens to this Arbitrum address. Ensure you are on Arbitrum One network.',
        qrCode: `ethereum:${user.arbitrumAddress}?token=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`,
        warning: '⚠️ Only send USDT tokens on Arbitrum One. Sending from other networks will result in loss of funds.'
      });
    } else {
      depositInfo.deposits.push({
        asset: 'USDT',
        network: 'Arbitrum One',
        address: null,
        message: 'Arbitrum address not generated yet. Please create an Arbitrum account first.',
        endpoint: `/api/users/${userId}/arbitrum-account`
      });
    }

    // Current balances
    depositInfo.currentBalances = user.balances.map(balance => ({
      currency: balance.currency,
      amount: balance.amount
    }));

    res.status(200).json({ success: true, data: depositInfo });

  } catch (error) {
    console.error('Error getting deposit info:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get deposit information', 
      error: error.message 
    });
  }
};

// @desc    Process a deposit (called by monitoring service or webhook)
// @route   POST /api/users/:userId/deposit/process
// @access  Private (should be authenticated/authorized in production)
const processDeposit = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { asset, amount, txHash, confirmations, fromAddress } = req.body;

    // Validation
    if (!asset || !amount || !txHash) {
      return res.status(400).json({ 
        success: false, 
        message: 'Asset, amount, and txHash are required' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount must be greater than 0' 
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Map asset to internal currency format
    let currency;
    let requiredConfirmations;
    
    switch (asset.toUpperCase()) {
      case 'BTC':
      case 'BITCOIN':
        currency = 'SAT-BTC';
        requiredConfirmations = 3;
        // Verify the deposit is to the user's Bitcoin address
        if (!user.bitcoinAddress) {
          return res.status(400).json({ 
            success: false, 
            message: 'User does not have a Bitcoin address registered' 
          });
        }
        break;
      
      case 'PYUSD':
      case 'PYUSD-ARB':
        currency = 'PYUSD-ARB';
        requiredConfirmations = 12;
        // Verify the deposit is to the user's Arbitrum address
        if (!user.arbitrumAddress) {
          return res.status(400).json({ 
            success: false, 
            message: 'User does not have an Arbitrum address registered' 
          });
        }
        break;
      
      case 'USDT':
      case 'USDT-ARB':
        currency = 'USDT-ARB';
        requiredConfirmations = 12;
        // Verify the deposit is to the user's Arbitrum address
        if (!user.arbitrumAddress) {
          return res.status(400).json({ 
            success: false, 
            message: 'User does not have an Arbitrum address registered' 
          });
        }
        break;
      
      default:
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported asset: ${asset}` 
        });
    }

    // Check if deposit has enough confirmations
    const currentConfirmations = confirmations || 0;
    const status = currentConfirmations >= requiredConfirmations ? 'completed' : 'pending';

    // Find the balance entry for this currency
    const balanceEntry = user.balances.find(b => b.currency === currency);
    
    if (!balanceEntry) {
      return res.status(400).json({ 
        success: false, 
        message: `Currency ${currency} not found in user balances` 
      });
    }

    // Update balance only if status is completed
    if (status === 'completed') {
      balanceEntry.amount += amount;
    }

    await user.save();

    // Create transaction record
    const Transaction = require('../models/transactionModel');
    const transaction = await Transaction.create({
      user: user._id,
      type: 'deposit',
      currency: currency,
      amount: amount,
      status: status,
      metadata: {
        txHash: txHash,
        confirmations: currentConfirmations,
        requiredConfirmations: requiredConfirmations,
        fromAddress: fromAddress,
        processedAt: status === 'completed' ? new Date() : null
      }
    });

    res.status(200).json({ 
      success: true, 
      message: status === 'completed' 
        ? 'Deposit processed successfully' 
        : `Deposit pending. ${currentConfirmations}/${requiredConfirmations} confirmations`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          balances: user.balances
        },
        transaction: transaction
      }
    });

  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process deposit', 
      error: error.message 
    });
  }
};

module.exports = {
  getDepositInfo,
  processDeposit,
};

