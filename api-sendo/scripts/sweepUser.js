#!/usr/bin/env node
/**
 * Sweep User Script
 * Manually sweep funds from a specific user
 */

const mongoose = require('mongoose');
const { ethers } = require('ethers');
require('dotenv').config();

const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');
const { signEvmTransactionWithMPC } = require('../services/nearService');

const PYUSD_CONTRACT = '0x46850ad61c2b7d64d08c9c754f45254596696984';
const USDT_CONTRACT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

async function sweepUser(phoneNumber, currency) {
  try {
    console.log('💸 Starting Manual Sweep\n');
    
    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`\n📊 User: ${user.name}`);
    console.log(`   Address: ${user.arbitrumAddress}`);

    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    console.log(`\n✅ Connected to RPC`);

    // Setup contract
    const contractAddress = currency === 'PYUSD-ARB' ? PYUSD_CONTRACT : USDT_CONTRACT;
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);

    // Check balance
    console.log(`\n📊 Checking ${currency} balance...`);
    const balance = await contract.balanceOf(user.arbitrumAddress);
    const amount = parseFloat(ethers.formatUnits(balance, 6));
    
    console.log(`   On-chain: ${amount} ${currency}`);
    
    const dbBalance = user.balances.find(b => b.currency === currency)?.amount || 0;
    console.log(`   DB: ${dbBalance} ${currency}`);

    if (amount < 0.01) {
      console.log('\n⚠️  Balance too low to sweep (<0.01)');
      process.exit(0);
    }

    // Calculate sweep amount (leave a tiny bit for gas rounding)
    const sweepAmount = Math.floor(amount * 1000000);
    console.log(`\n💰 Sweep amount: ${amount} ${currency}`);

    // Treasury address
    const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS;
    console.log(`   To treasury: ${treasuryAddress}`);

    // Estimate gas
    console.log(`\n⛽ Estimating gas...`);
    const gasEstimate = await contract.transfer.estimateGas(
      treasuryAddress,
      sweepAmount,
      { from: user.arbitrumAddress }
    );
    console.log(`   Gas estimate: ${gasEstimate.toString()}`);

    // Get gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const gasCost = gasEstimate * gasPrice;
    const ethNeeded = gasCost * 120n / 100n; // 20% buffer
    
    console.log(`   Gas cost: ${ethers.formatEther(gasCost)} ETH`);
    console.log(`   ETH needed (with buffer): ${ethers.formatEther(ethNeeded)} ETH`);

    // Send ETH from gas sponsor
    console.log(`\n⛽ Sending ETH from gas sponsor...`);
    const gasSponsorWallet = new ethers.Wallet(
      process.env.GAS_SPONSOR_PRIVATE_KEY,
      provider
    );
    
    const gasTx = await gasSponsorWallet.sendTransaction({
      to: user.arbitrumAddress,
      value: ethNeeded
    });
    
    console.log(`   TX Hash: ${gasTx.hash}`);
    await gasTx.wait();
    console.log(`   ✅ ETH sent`);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Prepare transfer transaction
    console.log(`\n📝 Preparing transfer transaction...`);
    const transferData = contract.interface.encodeFunctionData('transfer', [
      treasuryAddress,
      sweepAmount
    ]);

    const nonce = await provider.getTransactionCount(user.arbitrumAddress);
    console.log(`   Nonce: ${nonce}`);

    const tx = {
      to: contractAddress,
      data: transferData,
      nonce: Number(nonce),
      gasLimit: Number(gasEstimate * 120n / 100n),
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null,
      chainId: 42161,
      type: 2
    };

    console.log(`\n🔐 Signing with NEAR MPC...`);
    const sanitized = phoneNumber.replace(/[^0-9]/g, '');
    const derivationPath = `arb-${sanitized}`;
    
    const signedTx = await signEvmTransactionWithMPC(derivationPath, tx);
    console.log(`   ✅ Transaction signed`);

    // Broadcast transaction
    console.log(`\n📡 Broadcasting transaction...`);
    const receipt = await provider.broadcastTransaction(signedTx);
    console.log(`   TX Hash: ${receipt.hash}`);
    
    console.log(`\n⏳ Waiting for confirmation...`);
    const confirmation = await receipt.wait();
    console.log(`   ✅ Confirmed in block ${confirmation.blockNumber}`);

    // Update database
    console.log(`\n📝 Updating database...`);
    
    // Create transaction record
    await Transaction.create({
      user: user._id,
      type: 'sweep',
      currency: currency,
      amount: amount,
      status: 'completed',
      metadata: {
        txHash: receipt.hash,
        to: treasuryAddress,
        gasUsed: confirmation.gasUsed.toString(),
        processedAt: new Date()
      }
    });

    // Update balance
    const balanceEntry = user.balances.find(b => b.currency === currency);
    if (balanceEntry) {
      balanceEntry.amount = 0;
      await user.save();
    }

    console.log(`\n✅ Sweep completed successfully!`);
    console.log(`   Amount: ${amount} ${currency}`);
    console.log(`   TX: https://arbiscan.io/tx/${receipt.hash}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse arguments
const phoneNumber = process.argv[2];
const currency = process.argv[3] || 'PYUSD-ARB';

if (!phoneNumber) {
  console.error('Usage: node scripts/sweepUser.js <PHONE> [CURRENCY]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/sweepUser.js "+523111392820" "PYUSD-ARB"');
  process.exit(1);
}

sweepUser(phoneNumber, currency);

