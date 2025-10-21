const express = require('express');
const router = express.Router({ mergeParams: true });
const { createBitcoinAccount } = require('../controllers/bitcoinController');

router.route('/').post(createBitcoinAccount);

module.exports = router;

