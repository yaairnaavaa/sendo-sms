# Environment Variables Configuration

This document describes all environment variables needed to run the SENDO SMS API.

## Server Configuration

```env
NODE_ENV=development
PORT=3000
```

## Database Configuration

```env
MONGODB_URI=mongodb://localhost:27017/sendo
```

## NEAR Protocol Configuration (MPC)

```env
NEAR_ACCOUNT_ID=your-account.testnet
NEAR_PRIVATE_KEY=ed25519:YOUR_PRIVATE_KEY_HERE
NEAR_MPC_CONTRACT_ID=v1.signer-prod.testnet
NEAR_NETWORK_ID=testnet
```

## Blockchain RPC Endpoints

```env
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BITCOIN_RPC_URL=https://blockstream.info/api
```

## Wallet Configuration

### Gas Sponsor Wallet
Pays for sweep transaction gas fees. Should ONLY hold ETH for gas, not tokens.
Fund with ~1-2 ETH on Arbitrum for gas fees.

```env
GAS_SPONSOR_PRIVATE_KEY=your_gas_sponsor_private_key_here
```

### Treasury Wallet
Receives consolidated funds from sweeps. Use a secure cold wallet address.

```env
TREASURY_WALLET_ADDRESS=0xYourTreasuryAddressHere
```

### Hot Wallet for Withdrawals
Separate from deposit addresses. Should be funded with PYUSD, USDT, and ETH for gas.

```env
WITHDRAWAL_HOT_WALLET_PRIVATE_KEY=your_hot_wallet_private_key_here
```

## Sweep Service Configuration

### Sweep Mode
- `smart`: Liquidity-driven (RECOMMENDED) - only sweeps when treasury liquidity is low
- `threshold`: Balance-based - sweeps whenever user balances exceed thresholds
- `disabled`: No automatic sweeping (manual only via API)

```env
SWEEP_MODE=smart
SWEEP_INTERVAL_HOURS=6
```

### Sweep Thresholds
Only sweep when user balance exceeds these amounts:

```env
SWEEP_THRESHOLD_PYUSD=100
SWEEP_THRESHOLD_USDT=100
SWEEP_THRESHOLD_BTC=1000000
```

### Treasury Reserve Targets
Smart sweep triggers when treasury falls below these levels:

```env
MIN_TREASURY_RESERVE_PYUSD=10000
MIN_TREASURY_RESERVE_USDT=10000
```

## Withdrawal Configuration

```env
MIN_WITHDRAWAL_AMOUNT_PYUSD=0.1
MAX_WITHDRAWAL_AMOUNT_PYUSD=10000
MIN_WITHDRAWAL_AMOUNT_USDT=0.1
MAX_WITHDRAWAL_AMOUNT_USDT=10000

WITHDRAWAL_FEE_PYUSD=0.5
WITHDRAWAL_FEE_USDT=0.5
```

## Three-Tier Wallet Architecture

### 1. Gas Sponsor Wallet (Hot)
- **Purpose**: Funds gas for sweep operations
- **Holdings**: ETH only (~1-2 ETH on Arbitrum)
- **Security**: Hot wallet, monitored

### 2. User Deposit Addresses (MPC-Derived)
- **Purpose**: Receive user deposits
- **Holdings**: Tokens (PYUSD, USDT, BTC)
- **Security**: MPC-controlled, no private keys stored

### 3. Treasury Wallet (Cold)
- **Purpose**: Store consolidated funds
- **Holdings**: Most tokens
- **Security**: Cold storage (hardware wallet/multi-sig recommended)

### 4. Hot Wallet (For Withdrawals)
- **Purpose**: Process user withdrawals
- **Holdings**: Limited liquidity for daily operations
- **Security**: Hot wallet, strict limits, monitored



