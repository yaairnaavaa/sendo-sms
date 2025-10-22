const { ethers } = require('ethers');
const { getAdapter } = require('../services/nearService');
require('dotenv').config();

const PYUSD_CONTRACT = '0x46850ad61c2b7d64d08c9c754f45254596696984';
const USER_ADDRESS = '0x2355732464d6d11d419535dbd25391916218897e';
const PHONE_NUMBER = '+19876543210'; // Test User 2
const TREASURY = process.env.TREASURY_WALLET_ADDRESS;

const PYUSD_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

async function testSweepStep() {
  try {
    console.log('🧪 Testing sweep step-by-step...\n');

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const pyusd = new ethers.Contract(PYUSD_CONTRACT, PYUSD_ABI, provider);

    // Step 1: Get balance
    console.log('Step 1: Getting balance...');
    const balance = await pyusd.balanceOf(USER_ADDRESS);
    const balanceFormatted = ethers.formatUnits(balance, 6);
    console.log(`✅ Balance: ${balanceFormatted} PYUSD\n`);

    // Step 2: Estimate gas
    console.log('Step 2: Estimating gas...');
    const startEstimate = Date.now();
    const gasEstimate = await pyusd.transfer.estimateGas(
      TREASURY,
      balance,
      { from: USER_ADDRESS }
    );
    console.log(`✅ Gas estimate: ${gasEstimate.toString()} (took ${Date.now() - startEstimate}ms)\n`);

    // Step 3: Get fee data
    console.log('Step 3: Getting fee data...');
    const startFeeData = Date.now();
    const feeData = await provider.getFeeData();
    console.log(`✅ Gas price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei (took ${Date.now() - startFeeData}ms)\n`);

    // Step 4: Calculate ETH needed
    const gasNeeded = gasEstimate * BigInt(120) / BigInt(100);
    const ethNeeded = gasNeeded * feeData.gasPrice;
    console.log(`Step 4: ETH needed for gas: ${ethers.formatEther(ethNeeded)} ETH\n`);

    // Step 5: Get MPC adapter
    console.log('Step 5: Getting MPC adapter...');
    const phoneClean = PHONE_NUMBER.replace(/\D/g, '');
    const derivationPath = `arb-${phoneClean}`;
    console.log(`Derivation path: ${derivationPath}`);
    
    const startAdapter = Date.now();
    console.log('⏳ This might take a while (MPC call to NEAR)...');
    
    const adapter = await getAdapter(derivationPath);
    console.log(`✅ MPC adapter created (took ${Date.now() - startAdapter}ms)`);
    console.log(`   Address: ${adapter.address}\n`);

    // Step 6: Build transaction
    console.log('Step 6: Building transaction...');
    const tx = await pyusd.transfer.populateTransaction(
      TREASURY,
      balance
    );

    tx.from = USER_ADDRESS;
    tx.chainId = 42161;
    tx.gasLimit = gasNeeded;
    tx.gasPrice = feeData.gasPrice;
    
    const startNonce = Date.now();
    tx.nonce = await provider.getTransactionCount(USER_ADDRESS);
    console.log(`✅ Transaction built (nonce: ${tx.nonce}, took ${Date.now() - startNonce}ms)\n`);

    console.log('Transaction details:');
    console.log(`  To: ${tx.to}`);
    console.log(`  From: ${tx.from}`);
    console.log(`  Value: 0 ETH`);
    console.log(`  Gas Limit: ${tx.gasLimit.toString()}`);
    console.log(`  Gas Price: ${ethers.formatUnits(tx.gasPrice, 'gwei')} gwei`);
    console.log(`  Nonce: ${tx.nonce}\n`);

    console.log('✅ All pre-flight checks passed!');
    console.log('\n⚠️ NOT SENDING TRANSACTION (this is a test)\n');
    console.log('If you want to actually send the transaction, the sweep service would now:');
    console.log('1. Send ETH from gas sponsor to user address');
    console.log('2. Call adapter.signAndSendTransaction(tx)');
    console.log('3. Wait for confirmation');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

testSweepStep();

