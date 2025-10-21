const express = require('express');
const router = express.Router();
const {
  createWithdrawal,
  getUserWithdrawals,
  getWithdrawal,
  validateWithdrawal,
  getHotWalletBalances,
  estimateWithdrawalCost,
  getWithdrawalInfo
} = require('../controllers/withdrawalController');

/**
 * Rutas para el manejo de retiros (withdrawals)
 */

// Obtener información general sobre retiros (límites, fees, etc)
router.get('/info', getWithdrawalInfo);

// Validar un retiro sin ejecutarlo (dry run)
router.post('/validate', validateWithdrawal);

// Estimar el costo de un retiro
router.post('/estimate-cost', estimateWithdrawalCost);

// Crear un nuevo retiro
router.post('/', createWithdrawal);

// Obtener balances de la hot wallet (solo admin) - DEBE IR ANTES DE /:transactionId
router.get('/hot-wallet/balances', getHotWalletBalances);

// Obtener retiros de un usuario específico
router.get('/user/:userId', getUserWithdrawals);

// Obtener información de un retiro específico - DEBE IR AL FINAL
router.get('/:transactionId', getWithdrawal);

module.exports = router;

