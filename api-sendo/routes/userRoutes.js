const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserByPhone
} = require('../controllers/userController');

// Re-route into other resource routers
const balanceRouter = require('./balanceRoutes');
const transactionRouter = require('./transactionRoutes');
const arbitrumRouter = require('./arbitrumRoutes');
const bitcoinRouter = require('./bitcoinRoutes');
const depositRouter = require('./depositRoutes');

router.use('/:userId/balances', balanceRouter);
router.use('/:userId/transactions', transactionRouter);
router.use('/:userId/arbitrum-account', arbitrumRouter);
router.use('/:userId/bitcoin-account', bitcoinRouter);
router.use('/:userId/deposit', depositRouter);

router.route('/').get(getUsers).post(createUser);
router.route('/phone/:phone').get(getUserByPhone);
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

module.exports = router;
