const { ethers } = require('ethers');
const dotenv = require('dotenv');
dotenv.config();

const ARBITRUM_RPC = 'https://rpc.ankr.com/arbitrum';
const PYUSD = '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8';
const USDT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function checkBalances() {
  const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
  const wallet = new ethers.Wallet(process.env.WITHDRAWAL_HOT_WALLET_PRIVATE_KEY, provider);
  
  console.log('Checking balances for:', wallet.address);
  console.log('');
  
  // ETH Balance
  const ethBalance = await provider.getBalance(wallet.address);
  console.log('💎 ETH:', ethers.formatEther(ethBalance), 'ETH');
  
  // PYUSD Balance
  try {
    const pyusdContract = new ethers.Contract(PYUSD, ERC20_ABI, provider);
    const pyusdBalance = await pyusdContract.balanceOf(wallet.address);
    console.log('💵 PYUSD:', ethers.formatUnits(pyusdBalance, 6), 'PYUSD');
  } catch (error) {
    console.log('❌ PYUSD: Error -', error.message);
  }
  
  // USDT Balance
  try {
    const usdtContract = new ethers.Contract(USDT, ERC20_ABI, provider);
    const usdtBalance = await usdtContract.balanceOf(wallet.address);
    console.log('💵 USDT:', ethers.formatUnits(usdtBalance, 6), 'USDT');
  } catch (error) {
    console.log('❌ USDT: Error -', error.message);
  }
}

checkBalances().catch(console.error);

