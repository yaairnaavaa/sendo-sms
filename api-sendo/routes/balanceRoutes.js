const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getBalances,
  updateBalances,
} = require('../controllers/balanceController');

router.route('/').get(getBalances).put(updateBalances);

module.exports = router;
