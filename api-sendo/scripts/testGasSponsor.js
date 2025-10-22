const { ethers } = require('ethers');
require('dotenv').config();

const USER_ADDRESS = '0x2355732464d6d11d419535dbd25391916218897e';

async function testGasSponsor() {
  try {
    console.log('🧪 Testing Gas Sponsor Transfer\n');

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const gasSponsorKey = process.env.GAS_SPONSOR_PRIVATE_KEY;
    
    if (!gasSponsorKey) {
      console.error('❌ GAS_SPONSOR_PRIVATE_KEY not configured!');
      return;
    }

    const gasSponsorWallet = new ethers.Wallet(gasSponsorKey, provider);
    console.log(`Gas Sponsor: ${gasSponsorWallet.address}`);

    // Check sponsor balance
    const sponsorBalance = await provider.getBalance(gasSponsorWallet.address);
    console.log(`Sponsor ETH: ${ethers.formatEther(sponsorBalance)} ETH\n`);

    if (sponsorBalance === 0n) {
      console.error('❌ Gas sponsor has no ETH!');
      return;
    }

    // Check user balance
    const userBalance = await provider.getBalance(USER_ADDRESS);
    console.log(`User ETH before: ${ethers.formatEther(userBalance)} ETH`);

    // Send small amount of ETH
    const ethToSend = ethers.parseEther('0.000004'); // ~$0.01
    console.log(`\nSending ${ethers.formatEther(ethToSend)} ETH to user...`);
    
    const startTime = Date.now();
    console.log('⏳ Sending transaction...');
    
    const tx = await gasSponsorWallet.sendTransaction({
      to: USER_ADDRESS,
      value: ethToSend,
      gasLimit: 21000
    });

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log(`   Took ${Date.now() - startTime}ms`);
    console.log('\n⏳ Waiting for confirmation...');
    
    const startWait = Date.now();
    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`   Took ${Date.now() - startWait}ms`);

    // Check new balance
    const newUserBalance = await provider.getBalance(USER_ADDRESS);
    console.log(`\nUser ETH after: ${ethers.formatEther(newUserBalance)} ETH`);
    console.log(`\n✅ Gas sponsor transfer works!`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testGasSponsor();

