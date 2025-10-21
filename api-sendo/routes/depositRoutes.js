const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getDepositInfo,
  processDeposit,
} = require('../controllers/depositController');

// GET /api/users/:userId/deposit - Get deposit information
router.get('/', getDepositInfo);

// POST /api/users/:userId/deposit/process - Process a deposit (webhook/manual)
router.post('/process', processDeposit);

module.exports = router;

