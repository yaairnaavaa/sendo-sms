const express = require('express');
const router = express.Router();
const { startMonitoring, stopMonitoring, getMonitors } = require('../services/blockchainMonitor');

// @desc    Get monitoring status
// @route   GET /api/monitor/status
// @access  Private (add authentication in production)
router.get('/status', (req, res) => {
  const { arbitrumMonitor, bitcoinMonitor, sweepService } = getMonitors();
  
  res.json({
    success: true,
    data: {
      arbitrum: {
        active: arbitrumMonitor !== null,
        lastCheckedBlock: arbitrumMonitor?.lastCheckedBlock || null
      },
      bitcoin: {
        active: bitcoinMonitor !== null
      },
      sweep: {
        active: sweepService !== null
      }
    }
  });
});

// @desc    Start monitoring services
// @route   POST /api/monitor/start
// @access  Private (add authentication in production)
router.post('/start', async (req, res) => {
  try {
    await startMonitoring();
    res.json({
      success: true,
      message: 'Monitoring services started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start monitoring services',
      error: error.message
    });
  }
});

// @desc    Stop monitoring services
// @route   POST /api/monitor/stop
// @access  Private (add authentication in production)
router.post('/stop', (req, res) => {
  try {
    stopMonitoring();
    res.json({
      success: true,
      message: 'Monitoring services stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop monitoring services',
      error: error.message
    });
  }
});

// @desc    Trigger manual balance sync
// @route   POST /api/monitor/sync
// @access  Private (add authentication in production)
router.post('/sync', async (req, res) => {
  try {
    const { arbitrumMonitor } = getMonitors();
    
    if (!arbitrumMonitor) {
      return res.status(400).json({
        success: false,
        message: 'Arbitrum monitor is not running'
      });
    }

    await arbitrumMonitor.syncAllBalances();
    
    res.json({
      success: true,
      message: 'Balance sync completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync balances',
      error: error.message
    });
  }
});

// @desc    Trigger manual sweep check
// @route   POST /api/monitor/sweep
// @access  Private (add authentication in production)
router.post('/sweep', async (req, res) => {
  try {
    const { sweepService } = getMonitors();
    
    if (!sweepService) {
      return res.status(400).json({
        success: false,
        message: 'Sweep service is not running'
      });
    }

    await sweepService.checkAndSweep();
    
    res.json({
      success: true,
      message: 'Sweep check completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check sweep',
      error: error.message
    });
  }
});

module.exports = router;

