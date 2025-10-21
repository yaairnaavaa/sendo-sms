const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getUserTransactions,
  createTransaction,
} = require('../controllers/transactionController');

router.route('/')
  .get(getUserTransactions)
  .post(createTransaction);

module.exports = router;
