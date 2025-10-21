const { getWithdrawalService } = require('../services/withdrawalService');
const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');

/**
 * @desc    Iniciar un retiro de fondos
 * @route   POST /api/withdrawals
 * @access  Public (en producción debería estar autenticado)
 */
const createWithdrawal = async (req, res) => {
  try {
    const { userId, currency, amount, destinationAddress } = req.body;

    // Validar campos requeridos
    if (!userId || !currency || !amount || !destinationAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, currency, amount, destinationAddress'
      });
    }

    // Validar que el amount sea un número válido
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Obtener el servicio de withdrawal
    const withdrawalService = getWithdrawalService();

    // Procesar el retiro
    const result = await withdrawalService.processWithdrawal(
      userId,
      currency,
      numAmount,
      destinationAddress
    );

    res.status(200).json({
      success: true,
      message: 'Withdrawal completed successfully',
      data: {
        transactionId: result.transaction._id,
        txHash: result.txHash,
        feeTxHash: result.feeTxHash,
        amount: numAmount,
        currency: currency,
        destinationAddress: destinationAddress,
        fee: result.transaction.metadata.fee,
        totalDeducted: result.transaction.metadata.totalDeducted,
        status: result.transaction.status,
        feesSentToTreasury: result.transaction.metadata.feesSentToTreasury
      }
    });

  } catch (error) {
    console.error('Error creating withdrawal:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal',
      error: error.message
    });
  }
};

/**
 * @desc    Obtener el historial de retiros de un usuario
 * @route   GET /api/withdrawals/user/:userId
 * @access  Public (en producción debería estar autenticado)
 */
const getUserWithdrawals = async (req, res) => {
  try {
    const { userId } = req.params;

    const withdrawals = await Transaction.find({
      user: userId,
      type: 'withdrawal'
    })
    .sort({ createdAt: -1 })
    .limit(50);

    res.status(200).json({
      success: true,
      count: withdrawals.length,
      data: withdrawals
    });

  } catch (error) {
    console.error('Error getting user withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

/**
 * @desc    Obtener información de un retiro específico
 * @route   GET /api/withdrawals/:transactionId
 * @access  Public (en producción debería estar autenticado)
 */
const getWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const withdrawal = await Transaction.findById(transactionId).populate('user', 'name email phoneNumber');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.type !== 'withdrawal') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not a withdrawal'
      });
    }

    res.status(200).json({
      success: true,
      data: withdrawal
    });

  } catch (error) {
    console.error('Error getting withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

/**
 * @desc    Validar un retiro sin ejecutarlo (dry run)
 * @route   POST /api/withdrawals/validate
 * @access  Public (en producción debería estar autenticado)
 */
const validateWithdrawal = async (req, res) => {
  try {
    const { userId, currency, amount, destinationAddress } = req.body;

    // Validar campos requeridos
    if (!userId || !currency || !amount || !destinationAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, currency, amount, destinationAddress'
      });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Obtener el servicio de withdrawal
    const withdrawalService = getWithdrawalService();

    // Validar el retiro sin ejecutarlo
    const validation = await withdrawalService.validateWithdrawal(
      userId,
      currency,
      numAmount,
      destinationAddress
    );

    if (validation.valid) {
      res.status(200).json({
        success: true,
        valid: true,
        message: 'Withdrawal is valid',
        data: {
          amount: numAmount,
          currency: currency,
          fee: validation.fee,
          totalRequired: validation.totalRequired,
          destinationAddress: destinationAddress
        }
      });
    } else {
      res.status(400).json({
        success: false,
        valid: false,
        message: 'Withdrawal validation failed',
        errors: validation.errors
      });
    }

  } catch (error) {
    console.error('Error validating withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

/**
 * @desc    Obtener los balances de la hot wallet
 * @route   GET /api/withdrawals/hot-wallet/balances
 * @access  Private (solo admin)
 */
const getHotWalletBalances = async (req, res) => {
  try {
    const withdrawalService = getWithdrawalService();
    const balances = await withdrawalService.getHotWalletBalances();

    res.status(200).json({
      success: true,
      data: balances
    });

  } catch (error) {
    console.error('Error getting hot wallet balances:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

/**
 * @desc    Estimar el costo de un retiro
 * @route   POST /api/withdrawals/estimate-cost
 * @access  Public
 */
const estimateWithdrawalCost = async (req, res) => {
  try {
    const { currency, amount, destinationAddress } = req.body;

    if (!currency || !amount || !destinationAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: currency, amount, destinationAddress'
      });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const withdrawalService = getWithdrawalService();
    const estimate = await withdrawalService.estimateWithdrawalCost(
      currency,
      numAmount,
      destinationAddress
    );

    res.status(200).json({
      success: true,
      data: estimate
    });

  } catch (error) {
    console.error('Error estimating withdrawal cost:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

/**
 * @desc    Obtener información sobre límites y fees de retiro
 * @route   GET /api/withdrawals/info
 * @access  Public
 */
const getWithdrawalInfo = async (req, res) => {
  try {
    const withdrawalService = getWithdrawalService();

    res.status(200).json({
      success: true,
      data: {
        supportedCurrencies: ['PYUSD-ARB', 'USDT-ARB'],
        minimumAmounts: withdrawalService.minWithdrawalAmount,
        maximumAmounts: withdrawalService.maxWithdrawalAmount,
        fees: withdrawalService.withdrawalFees,
        requiredConfirmations: 2,
        note: 'Fees are deducted from your balance in addition to the withdrawal amount'
      }
    });

  } catch (error) {
    console.error('Error getting withdrawal info:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

module.exports = {
  createWithdrawal,
  getUserWithdrawals,
  getWithdrawal,
  validateWithdrawal,
  getHotWalletBalances,
  estimateWithdrawalCost,
  getWithdrawalInfo
};

