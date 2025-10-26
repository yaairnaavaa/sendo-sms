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
// @body    { updateDB: boolean } - Optional: if true, updates database with on-chain balances
// @note    Use updateDB=true ONLY when monitoring is stopped to avoid race conditions
//          The sync will detect missed deposits (on-chain > DB) or missed sweeps (on-chain < DB)
router.post('/sync', async (req, res) => {
  try {
    const { arbitrumMonitor } = getMonitors();
    
    if (!arbitrumMonitor) {
      return res.status(400).json({
        success: false,
        message: 'Arbitrum monitor is not running'
      });
    }

    const updateDB = req.body?.updateDB === true;
    const results = await arbitrumMonitor.syncAllBalances(updateDB);
    
    res.json({
      success: true,
      message: updateDB ? 'Balance sync and update completed' : 'Balance sync completed (read-only)',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync balances',
      error: error.message
    });
  }
});

// @desc    Trigger manual sweep check (threshold-based)
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

    const result = await sweepService.checkAndSweep();
    
    res.json({
      success: true,
      message: 'Sweep check completed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check sweep',
      error: error.message
    });
  }
});

// @desc    Trigger smart liquidity-driven sweep
// @route   POST /api/monitor/sweep/smart
// @access  Private (add authentication in production)
router.post('/sweep/smart', async (req, res) => {
  try {
    const { sweepService } = getMonitors();
    
    if (!sweepService) {
      return res.status(400).json({
        success: false,
        message: 'Sweep service is not running'
      });
    }

    const result = await sweepService.smartSweep();
    
    res.json({
      success: true,
      message: result.message || 'Smart sweep completed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute smart sweep',
      error: error.message
    });
  }
});

// @desc    Get sweep statistics and current state
// @route   GET /api/monitor/sweep/stats
// @access  Private (add authentication in production)
router.get('/sweep/stats', async (req, res) => {
  try {
    const { sweepService } = getMonitors();
    
    if (!sweepService) {
      return res.status(400).json({
        success: false,
        message: 'Sweep service is not running'
      });
    }

    const stats = await sweepService.getSweepStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get sweep stats',
      error: error.message
    });
  }
});

// @desc    Check if treasury needs liquidity
// @route   GET /api/monitor/sweep/liquidity-check
// @access  Private (add authentication in production)
router.get('/sweep/liquidity-check', async (req, res) => {
  try {
    const { sweepService } = getMonitors();
    
    if (!sweepService) {
      return res.status(400).json({
        success: false,
        message: 'Sweep service is not running'
      });
    }

    const liquidityCheck = await sweepService.shouldSweepForLiquidity();
    
    res.json({
      success: true,
      data: liquidityCheck
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check liquidity',
      error: error.message
    });
  }
});

module.exports = router;

