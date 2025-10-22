const { ethers } = require('ethers');
require('dotenv').config();

const PYUSD_CONTRACT = '0x46850ad61c2b7d64d08c9c754f45254596696984';
const USER_ADDRESS = '0x2355732464d6d11d419535dbd25391916218897e';
const TREASURY = process.env.TREASURY_WALLET_ADDRESS;

// Extended ABI with PYUSD-specific functions
const PYUSD_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function paused() view returns (bool)',
  'function isBlacklisted(address account) view returns (bool)',
  'function decimals() view returns (uint8)'
];

async function diagnosePYUSD() {
  try {
    console.log('🔍 Diagnosing PYUSD Transfer Issue\n');
    console.log(`User Address: ${USER_ADDRESS}`);
    console.log(`Treasury: ${TREASURY}\n`);

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const pyusd = new ethers.Contract(PYUSD_CONTRACT, PYUSD_ABI, provider);

    // 1. Check balance
    console.log('1. Checking balance...');
    const balance = await pyusd.balanceOf(USER_ADDRESS);
    const balanceFormatted = ethers.formatUnits(balance, 6);
    console.log(`   Balance: ${balanceFormatted} PYUSD`);
    console.log(`   Raw: ${balance.toString()}\n`);

    // 2. Check if contract is paused
    console.log('2. Checking if PYUSD contract is paused...');
    try {
      const isPaused = await pyusd.paused();
      console.log(`   Paused: ${isPaused}`);
      if (isPaused) {
        console.log('   ⚠️ PYUSD contract is PAUSED! Cannot transfer.\n');
        return;
      }
    } catch (e) {
      console.log(`   Could not check paused status: ${e.message}`);
    }
    console.log();

    // 3. Check if user is blacklisted
    console.log('3. Checking if user address is blacklisted...');
    try {
      const isUserBlacklisted = await pyusd.isBlacklisted(USER_ADDRESS);
      console.log(`   User blacklisted: ${isUserBlacklisted}`);
      if (isUserBlacklisted) {
        console.log('   🚫 USER ADDRESS IS BLACKLISTED!\n');
        return;
      }
    } catch (e) {
      console.log(`   Could not check blacklist: ${e.message}`);
    }
    console.log();

    // 4. Check if treasury is blacklisted
    console.log('4. Checking if treasury address is blacklisted...');
    try {
      const isTreasuryBlacklisted = await pyusd.isBlacklisted(TREASURY);
      console.log(`   Treasury blacklisted: ${isTreasuryBlacklisted}`);
      if (isTreasuryBlacklisted) {
        console.log('   🚫 TREASURY ADDRESS IS BLACKLISTED!\n');
        return;
      }
    } catch (e) {
      console.log(`   Could not check blacklist: ${e.message}`);
    }
    console.log();

    // 5. Try to simulate the transfer
    console.log('5. Simulating transfer call...');
    try {
      // Try calling (not sending) the transfer to see if it would succeed
      await pyusd.transfer.staticCall(
        TREASURY,
        balance,
        { from: USER_ADDRESS }
      );
      console.log('   ✅ Transfer simulation succeeded!\n');
    } catch (error) {
      console.log('   ❌ Transfer simulation FAILED!');
      console.log(`   Error: ${error.message}`);
      console.log(`   Error code: ${error.code}`);
      if (error.data) {
        console.log(`   Error data: ${error.data}`);
      }
      console.log();
    }

    // 6. Try with a smaller amount
    console.log('6. Testing with smaller amount (1 PYUSD)...');
    try {
      const smallAmount = ethers.parseUnits('1', 6);
      await pyusd.transfer.staticCall(
        TREASURY,
        smallAmount,
        { from: USER_ADDRESS }
      );
      console.log('   ✅ Small transfer simulation succeeded!\n');
    } catch (error) {
      console.log('   ❌ Small transfer also failed!');
      console.log(`   Error: ${error.message}\n`);
    }

    // 7. Check ETH balance for gas
    console.log('7. Checking ETH balance...');
    const ethBalance = await provider.getBalance(USER_ADDRESS);
    console.log(`   ETH: ${ethers.formatEther(ethBalance)}`);
    if (ethBalance === 0n) {
      console.log('   ⚠️ No ETH for gas fees!\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
  }
}

diagnosePYUSD();

