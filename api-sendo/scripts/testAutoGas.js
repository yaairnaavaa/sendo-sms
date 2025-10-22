const { ethers } = require('ethers');
require('dotenv').config();

const USER_ADDRESS = '0x2355732464d6d11d419535dbd25391916218897e';

async function testAutoGas() {
  try {
    console.log('🧪 Testing Auto Gas Configuration\n');

    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const gasSponsorKey = process.env.GAS_SPONSOR_PRIVATE_KEY;
    const gasSponsorWallet = new ethers.Wallet(gasSponsorKey, provider);

    console.log(`Gas Sponsor: ${gasSponsorWallet.address}`);

    const sponsorBalance = await provider.getBalance(gasSponsorWallet.address);
    console.log(`Sponsor ETH: ${ethers.formatEther(sponsorBalance)} ETH\n`);

    const ethToSend = ethers.parseEther('0.000004');
    console.log(`Sending ${ethers.formatEther(ethToSend)} ETH to user...`);
    console.log('⏳ Letting ethers.js handle gas automatically...\n');
    
    const tx = await gasSponsorWallet.sendTransaction({
      to: USER_ADDRESS,
      value: ethToSend
    });

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log(`   Type: ${tx.type}`);
    console.log(`   Gas Limit: ${tx.gasLimit?.toString()}`);
    console.log('\n⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`\n🎉 Success! The sweep should now work.\n`);
    console.log(`Check transaction: https://arbiscan.io/tx/${tx.hash}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testAutoGas();

