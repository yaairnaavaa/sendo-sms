const express = require('express');
const router = express.Router({ mergeParams: true });
const { createArbitrumAccount } = require('../controllers/arbitrumController');

router.route('/').post(createArbitrumAccount);

module.exports = router;
