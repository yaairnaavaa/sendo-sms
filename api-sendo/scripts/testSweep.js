const { ethers } = require('ethers');
require('dotenv').config();

const PYUSD_CONTRACT = '0x46850ad61c2b7d64d08c9c754f45254596696984';
const USER_ADDRESS = '0x2355732464d6d11d419535dbd25391916218897e';

async function testSweep() {
  try {
    console.log('🔍 Testing sweep prerequisites...\n');

    // Setup provider
    const rpcUrl = process.env.ARBITRUM_RPC_URL;
    console.log(`1. RPC URL: ${rpcUrl}`);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Test connection
    console.log('\n2. Testing RPC connection...');
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ Connected! Current block: ${blockNumber}`);

    // Check user's PYUSD balance
    console.log('\n3. Checking PYUSD balance...');
    const pyusdContract = new ethers.Contract(
      PYUSD_CONTRACT,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    
    const balance = await pyusdContract.balanceOf(USER_ADDRESS);
    const balanceFormatted = ethers.formatUnits(balance, 6);
    console.log(`   Balance: ${balanceFormatted} PYUSD`);

    // Check ETH balance
    console.log('\n4. Checking ETH balance for gas...');
    const ethBalance = await provider.getBalance(USER_ADDRESS);
    const ethFormatted = ethers.formatEther(ethBalance);
    console.log(`   ETH Balance: ${ethFormatted} ETH`);

    // Check gas sponsor wallet
    console.log('\n5. Checking gas sponsor wallet...');
    const gasSponsorKey = process.env.GAS_SPONSOR_PRIVATE_KEY;
    if (gasSponsorKey) {
      const gasSponsorWallet = new ethers.Wallet(gasSponsorKey, provider);
      const sponsorBalance = await provider.getBalance(gasSponsorWallet.address);
      console.log(`   Gas Sponsor: ${gasSponsorWallet.address}`);
      console.log(`   Gas Sponsor ETH: ${ethers.formatEther(sponsorBalance)} ETH`);
    } else {
      console.log('   ❌ GAS_SPONSOR_PRIVATE_KEY not configured!');
    }

    // Check treasury
    console.log('\n6. Treasury configuration...');
    const treasury = process.env.TREASURY_WALLET_ADDRESS;
    if (treasury) {
      console.log(`   Treasury: ${treasury}`);
    } else {
      console.log('   ❌ TREASURY_WALLET_ADDRESS not configured!');
    }

    // Try to estimate gas for a sweep
    if (parseFloat(balanceFormatted) > 0) {
      console.log('\n7. Estimating gas for sweep...');
      try {
        const gasEstimate = await pyusdContract.transfer.estimateGas(
          treasury,
          balance,
          { from: USER_ADDRESS }
        );
        console.log(`   ✅ Gas estimate: ${gasEstimate.toString()}`);
        
        const feeData = await provider.getFeeData();
        const gasCost = gasEstimate * feeData.gasPrice;
        console.log(`   Gas cost: ${ethers.formatEther(gasCost)} ETH`);
      } catch (error) {
        console.log(`   ❌ Gas estimation failed: ${error.message}`);
      }
    }

    console.log('\n✅ All checks completed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testSweep();

