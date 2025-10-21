const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Transaction must belong to a user'],
  },
  type: {
    type: String,
    required: [true, 'Transaction must have a type'],
    enum: ['deposit', 'withdrawal', 'transfer-sent', 'transfer-received'],
  },
  currency: {
    type: String,
    required: [true, 'Transaction must have a currency'],
    enum: ['PYUSD-ARB', 'USDT-ARB', 'SAT-BTC'],
  },
  amount: {
    type: Number,
    required: [true, 'Transaction must have an amount'],
    min: [0.000001, 'Amount must be a positive number'],
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed',
  },
  // Optional field for transfers between users
  relatedUser: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
  },
  // Additional metadata for tracking blockchain transactions
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
