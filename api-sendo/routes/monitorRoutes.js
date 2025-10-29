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

// @desc    Debug monitoring system - check all components
// @route   GET /api/monitor/debug
// @access  Private (add authentication in production)
router.get('/debug', async (req, res) => {
  try {
    const { arbitrumMonitor, bitcoinMonitor, sweepService } = getMonitors();
    const { ethers } = require('ethers');
    
    const debug = {
      timestamp: new Date().toISOString(),
      monitors: {
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
      },
      environment: {
        rpcUrl: process.env.ARBITRUM_RPC_URL?.substring(0, 50) + '...',
        hasSponsor: !!process.env.GAS_SPONSOR_PRIVATE_KEY,
        hasTreasury: !!process.env.TREASURY_WALLET_ADDRESS,
        sweepMode: process.env.SWEEP_MODE || 'not set',
        sweepInterval: process.env.SWEEP_INTERVAL_HOURS || 'not set'
      }
    };

    // Test RPC connection
    if (arbitrumMonitor) {
      try {
        const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
        const blockNumber = await provider.getBlockNumber();
        debug.rpc = {
          working: true,
          currentBlock: blockNumber,
          responseTime: 'OK'
        };
      } catch (error) {
        debug.rpc = {
          working: false,
          error: error.message
        };
      }
    }

    res.json({
      success: true,
      data: debug
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Debug check failed',
      error: error.message
    });
  }
});

// @desc    Check specific transaction/deposit by hash
// @route   GET /api/monitor/check-tx/:txHash
// @access  Private (add authentication in production)
router.get('/check-tx/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    const { ethers } = require('ethers');
    const Transaction = require('../models/transactionModel');
    
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    
    // Check blockchain
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return res.json({
        success: true,
        data: {
          found: false,
          message: 'Transaction not found on blockchain'
        }
      });
    }

    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    // Check database
    const dbTx = await Transaction.findOne({
      'metadata.txHash': txHash
    }).populate('user', 'name phoneNumber arbitrumAddress');

    // Parse PYUSD/USDT transfer events
    const PYUSD_CONTRACT = '0x46850ad61c2b7d64d08c9c754f45254596696984';
    const USDT_CONTRACT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
    
    const iface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]);

    const transfers = [];
    for (const log of receipt.logs) {
      const addr = log.address.toLowerCase();
      if (addr === PYUSD_CONTRACT.toLowerCase() || addr === USDT_CONTRACT.toLowerCase()) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'Transfer') {
            transfers.push({
              token: addr === PYUSD_CONTRACT.toLowerCase() ? 'PYUSD' : 'USDT',
              from: parsed.args.from,
              to: parsed.args.to,
              amount: ethers.formatUnits(parsed.args.value, 6)
            });
          }
        } catch (e) {}
      }
    }

    res.json({
      success: true,
      data: {
        found: true,
        blockchain: {
          txHash: txHash,
          blockNumber: receipt.blockNumber,
          confirmations: confirmations,
          status: receipt.status === 1 ? 'Success' : 'Failed',
          transfers: transfers
        },
        database: dbTx ? {
          found: true,
          status: dbTx.status,
          user: dbTx.user?.name,
          amount: dbTx.amount,
          currency: dbTx.currency,
          createdAt: dbTx.createdAt
        } : {
          found: false,
          message: 'Transaction not registered in database'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check transaction',
      error: error.message
    });
  }
});

module.exports = router;

