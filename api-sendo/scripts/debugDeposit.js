#!/usr/bin/env node
/**
 * Debug Deposit Script
 * 
 * Verifica por qué un depósito no fue detectado
 * Uso: node scripts/debugDeposit.js <TX_HASH> [USER_ADDRESS]
 */

const { ethers } = require('ethers');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');

const PYUSD_CONTRACT = '0x46850ad61c2b7d64d08c9c754f45254596696984';
const USDT_CONTRACT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

async function debugDeposit(txHash, userAddress) {
  try {
    console.log('🔍 Debugging Deposit\n');
    console.log(`TX Hash: ${txHash}`);
    if (userAddress) {
      console.log(`User Address: ${userAddress}\n`);
    }

    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    console.log(`✅ Connected to RPC: ${process.env.ARBITRUM_RPC_URL}\n`);

    // 1. Check blockchain
    console.log('📊 STEP 1: Checking Blockchain\n');
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.error('❌ Transaction not found on blockchain');
      process.exit(1);
    }

    console.log(`✅ Transaction found`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    console.log(`   Confirmations: ${confirmations}/12`);

    // 2. Parse Transfer events
    console.log('\n📊 STEP 2: Parsing Transfer Events\n');
    
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
            const token = addr === PYUSD_CONTRACT.toLowerCase() ? 'PYUSD' : 'USDT';
            const amount = ethers.formatUnits(parsed.args.value, 6);
            transfers.push({
              token,
              from: parsed.args.from,
              to: parsed.args.to,
              amount
            });
            console.log(`✅ ${token} Transfer found:`);
            console.log(`   From: ${parsed.args.from}`);
            console.log(`   To: ${parsed.args.to}`);
            console.log(`   Amount: ${amount} ${token}\n`);
          }
        } catch (e) {}
      }
    }

    if (transfers.length === 0) {
      console.log('❌ No PYUSD/USDT transfers found in this transaction');
      process.exit(1);
    }

    // 3. Check if addresses are in our system
    console.log('📊 STEP 3: Checking Users in Database\n');
    
    for (const transfer of transfers) {
      const user = await User.findOne({
        arbitrumAddress: transfer.to.toLowerCase()
      });

      if (user) {
        console.log(`✅ ${transfer.to} belongs to user: ${user.name}`);
        
        const balance = user.balances.find(b => 
          b.currency === `${transfer.token}-ARB`
        );
        console.log(`   Current balance in DB: ${balance?.amount || 0} ${transfer.token}`);
      } else {
        console.log(`❌ ${transfer.to} NOT found in database`);
        console.log(`   This address is not registered as a user deposit address`);
      }
      console.log('');
    }

    // 4. Check if transaction is in DB
    console.log('📊 STEP 4: Checking Transaction in Database\n');
    
    const dbTx = await Transaction.findOne({
      'metadata.txHash': txHash
    }).populate('user', 'name arbitrumAddress');

    if (dbTx) {
      console.log('✅ Transaction found in database');
      console.log(`   User: ${dbTx.user?.name || 'Unknown'}`);
      console.log(`   Type: ${dbTx.type}`);
      console.log(`   Status: ${dbTx.status}`);
      console.log(`   Amount: ${dbTx.amount} ${dbTx.currency}`);
      console.log(`   Created: ${dbTx.createdAt}`);
      
      if (dbTx.status === 'pending') {
        console.log(`\n⏳ Transaction is PENDING - waiting for confirmations`);
        console.log(`   Current: ${confirmations}/12`);
      } else if (dbTx.status === 'completed') {
        console.log(`\n✅ Transaction is COMPLETED`);
      } else {
        console.log(`\n⚠️  Transaction status: ${dbTx.status}`);
      }
    } else {
      console.log('❌ Transaction NOT found in database');
      console.log('\n🔍 Possible reasons:');
      console.log('   1. Monitor was not running when deposit arrived');
      console.log('   2. The destination address is not a user address');
      console.log('   3. Event listener failed to capture the event');
      console.log('   4. Database write failed');
    }

    // 5. Recommendations
    console.log('\n📋 RECOMMENDATIONS:\n');
    
    if (!dbTx && transfers.length > 0) {
      const userTransfer = transfers.find(async t => {
        const u = await User.findOne({ arbitrumAddress: t.to.toLowerCase() });
        return u !== null;
      });
      
      if (userTransfer) {
        console.log('✅ You can manually sync this user to update their balance:');
        console.log(`   curl -X POST http://localhost:3000/api/monitor/sync \\`);
        console.log(`     -H "Content-Type: application/json" \\`);
        console.log(`     -d '{"updateDB": true}'`);
      }
    }

    if (confirmations < 12) {
      console.log(`⏳ Transaction needs ${12 - confirmations} more confirmations`);
      console.log('   Wait a few minutes and check again');
    }

    console.log('\n✅ Debug complete\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const txHash = process.argv[2];
const userAddress = process.argv[3];

if (!txHash) {
  console.error('Usage: node scripts/debugDeposit.js <TX_HASH> [USER_ADDRESS]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/debugDeposit.js 0xabc123...');
  process.exit(1);
}

debugDeposit(txHash, userAddress);

