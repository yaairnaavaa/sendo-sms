const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: ['PYUSD-ARB', 'USDT-ARB', 'SAT-BTC'],
    trim: true,
  },
  amount: {
    type: Number,
    default: 0,
    min: [0, 'Amount cannot be negative'],
  },
});

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    // Basic validation for a phone number format
    match: [/^\+?[1-9]\d{1,14}$/, 'Please fill a valid phone number'],
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    // Basic email validation
    match: [/\S+@\S+\.\S+/, 'Please fill a valid email address'],
  },
  arbitrumAddress: {
    type: String,
    unique: true,
    sparse: true, // Allows null values to not violate the unique constraint
  },
  bitcoinAddress: {
    type: String,
    unique: true,
    sparse: true, // Allows null values to not violate the unique constraint
  },
  balances: [balanceSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Initialize balances for new users
userSchema.pre('save', function(next) {
  if (this.isNew && this.balances.length === 0) {
    this.balances.push(
      { currency: 'PYUSD-ARB', amount: 0 },
      { currency: 'USDT-ARB', amount: 0 },
      { currency: 'SAT-BTC', amount: 0 }
    );
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
