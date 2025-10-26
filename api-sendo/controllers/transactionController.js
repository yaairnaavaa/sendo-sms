const Transaction = require('../models/transactionModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');

// @desc    Get all transactions for a specific user
// @route   GET /api/users/:userId/transactions
// @access  Public
const getUserTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: transactions.length, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create a new transaction (deposit or withdrawal)
// @route   POST /api/users/:userId/transactions
// @access  Public
const createTransaction = async (req, res) => {
  const { type, currency, amount } = req.body;
  const userId = req.params.userId;

  if (!type || !currency || !amount) {
    return res.status(400).json({ success: false, message: 'Please provide type, currency, and amount' });
  }
  
  if (amount <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be positive' });
  }

  try {
    const user = await User.findOne({phoneNumber:userId});
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const balance = user.balances.find(b => b.currency === currency);
    if (!balance) {
      return res.status(404).json({ success: false, message: `Balance for currency ${currency} not found` });
    }

    if (type === 'deposit') {
      balance.amount += amount;
    } else if (type === 'withdrawal') {
      if (balance.amount < amount) {
        return res.status(400).json({ success: false, message: 'Insufficient funds' });
      }
      balance.amount -= amount;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid transaction type. Use this endpoint only for deposits and withdrawals.' });
    }
    
    await user.save();

    const transaction = await Transaction.create({
      user: userId,
      type,
      currency,
      amount,
      status: 'completed',
    });
    
    res.status(201).json({ success: true, data: transaction });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getUserTransactions,
  createTransaction,
};
