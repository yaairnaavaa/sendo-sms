const { ethers } = require('ethers');
const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');

/**
 * Withdrawal Service
 * 
 * Este servicio maneja los retiros de fondos desde la plataforma hacia direcciones externas.
 * Usa una HOT WALLET separada para enviar fondos (diferente a las wallets de depósito).
 */

// ERC20 ABI con funciones necesarias para transferencias
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// Configuración de contratos en Arbitrum
const ARBITRUM_CONTRACTS = {
  PYUSD: '0x46850ad61c2b7d64d08c9c754f45254596696984', // PYUSD en Arbitrum Mainnet
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
};

// Configuración de RPCs
const RPC_ENDPOINTS = {
  arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
};

/**
 * Servicio de Withdrawals para Arbitrum (PYUSD y USDT)
 */
class WithdrawalService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.arbitrum);
    
    // HOT WALLET para withdrawals - DIFERENTE a las wallets de depósito
    // Esta wallet debe tener fondos para cubrir los retiros
    const hotWalletPrivateKey = process.env.WITHDRAWAL_HOT_WALLET_PRIVATE_KEY;
    
    if (!hotWalletPrivateKey) {
      console.warn('⚠️ WITHDRAWAL_HOT_WALLET_PRIVATE_KEY not configured');
      this.hotWallet = null;
    } else {
      this.hotWallet = new ethers.Wallet(hotWalletPrivateKey, this.provider);
      console.log(`🔑 Withdrawal hot wallet initialized: ${this.hotWallet.address}`);
    }

    // Contratos
    this.pyusdContract = new ethers.Contract(
      ARBITRUM_CONTRACTS.PYUSD,
      ERC20_ABI,
      this.hotWallet || this.provider
    );
    
    this.usdtContract = new ethers.Contract(
      ARBITRUM_CONTRACTS.USDT,
      ERC20_ABI,
      this.hotWallet || this.provider
    );

    // Configuración de seguridad
    this.minWithdrawalAmount = {
      'PYUSD-ARB': 0.1,    // Mínimo 0.1 PYUSD
      'USDT-ARB': 0.1      // Mínimo 0.1 USDT
    };

    this.maxWithdrawalAmount = {
      'PYUSD-ARB': 10000,  // Máximo 10,000 PYUSD por transacción
      'USDT-ARB': 10000    // Máximo 10,000 USDT por transacción
    };

    // Configuración de fees
    this.withdrawalFees = {
      'PYUSD-ARB': 0.5,  // 0.5 PYUSD de fee
      'USDT-ARB': 0.5    // 0.5 USDT de fee
    };
  }

  /**
   * Verifica que la hot wallet esté configurada
   */
  checkHotWalletConfiguration() {
    if (!this.hotWallet) {
      throw new Error('Withdrawal hot wallet not configured. Please set WITHDRAWAL_HOT_WALLET_PRIVATE_KEY');
    }
  }

  /**
   * Obtiene el contrato según la moneda
   */
  getContract(currency) {
    switch (currency) {
      case 'PYUSD-ARB':
        return this.pyusdContract;
      case 'USDT-ARB':
        return this.usdtContract;
      default:
        throw new Error(`Unsupported currency: ${currency}`);
    }
  }

  /**
   * Valida una dirección de destino
   */
  validateAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica el balance de la hot wallet
   */
  async checkHotWalletBalance(currency, amount) {
    const contract = this.getContract(currency);
    const balance = await contract.balanceOf(this.hotWallet.address);
    const decimals = currency === 'USDT-ARB' ? 6 : 6; // Ambos usan 6 decimales
    const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
    
    return balanceFormatted >= amount;
  }

  /**
   * Valida una solicitud de retiro
   */
  async validateWithdrawal(userId, currency, amount, destinationAddress) {
    const errors = [];

    // 1. Validar que la moneda esté soportada
    if (!['PYUSD-ARB', 'USDT-ARB'].includes(currency)) {
      errors.push(`Currency ${currency} not supported for withdrawals`);
    }

    // 2. Validar dirección de destino
    if (!this.validateAddress(destinationAddress)) {
      errors.push('Invalid destination address');
    }

    // 3. Validar que no sea la misma dirección que la hot wallet
    if (destinationAddress.toLowerCase() === this.hotWallet.address.toLowerCase()) {
      errors.push('Cannot withdraw to hot wallet address');
    }

    // 4. Validar montos mínimos y máximos
    if (amount < this.minWithdrawalAmount[currency]) {
      errors.push(`Minimum withdrawal amount is ${this.minWithdrawalAmount[currency]} ${currency}`);
    }

    if (amount > this.maxWithdrawalAmount[currency]) {
      errors.push(`Maximum withdrawal amount is ${this.maxWithdrawalAmount[currency]} ${currency}`);
    }

    // 5. Verificar balance del usuario (incluyendo fee)
    const user = await User.findById(userId);
    if (!user) {
      errors.push('User not found');
      return { valid: false, errors, user: null };
    }

    const balanceEntry = user.balances.find(b => b.currency === currency);
    const fee = this.withdrawalFees[currency];
    const totalRequired = amount + fee;

    if (!balanceEntry || balanceEntry.amount < totalRequired) {
      errors.push(
        `Insufficient balance. Required: ${totalRequired} ${currency} (${amount} + ${fee} fee), ` +
        `Available: ${balanceEntry?.amount || 0} ${currency}`
      );
    }

    // 6. Verificar balance de la hot wallet (opcional - puede fallar con RPCs públicos)
    try {
      const hasHotWalletBalance = await this.checkHotWalletBalance(currency, amount);
      if (!hasHotWalletBalance) {
        errors.push('Insufficient balance in hot wallet. Please contact support.');
      }
    } catch (error) {
      console.log('⚠️  Could not verify hot wallet balance (RPC issue), proceeding anyway...');
      // No agregamos error aquí - el withdrawal fallará si realmente no hay fondos
    }

    return {
      valid: errors.length === 0,
      errors,
      user,
      fee,
      totalRequired
    };
  }

  /**
   * Procesa un retiro
   */
  async processWithdrawal(userId, currency, amount, destinationAddress) {
    this.checkHotWalletConfiguration();

    // Validar el retiro
    const validation = await this.validateWithdrawal(userId, currency, amount, destinationAddress);
    
    if (!validation.valid) {
      throw new Error(`Withdrawal validation failed: ${validation.errors.join(', ')}`);
    }

    const { user, fee, totalRequired } = validation;

    console.log(`💸 Processing withdrawal for user ${user.name}:`);
    console.log(`   Currency: ${currency}`);
    console.log(`   Amount: ${amount}`);
    console.log(`   Fee: ${fee}`);
    console.log(`   Total: ${totalRequired}`);
    console.log(`   Destination: ${destinationAddress}`);

    // Crear registro de transacción PENDING
    const transaction = await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      currency: currency,
      amount: amount,
      status: 'pending',
      metadata: {
        destinationAddress: destinationAddress,
        fee: fee,
        totalDeducted: totalRequired,
        hotWalletAddress: this.hotWallet.address,
        initiatedAt: new Date()
      }
    });

    try {
      // Deducir balance del usuario ANTES de enviar (para evitar double-spending)
      const balanceEntry = user.balances.find(b => b.currency === currency);
      balanceEntry.amount -= totalRequired;
      await user.save();

      console.log(`✅ Balance deducted from user ${user.name}`);

      // Enviar transacción a la blockchain
      const txHash = await this.sendToBlockchain(currency, amount, destinationAddress);

      // Actualizar transacción con el hash
      transaction.metadata.txHash = txHash;
      transaction.metadata.sentAt = new Date();
      await transaction.save();

      console.log(`📤 Transaction sent to blockchain: ${txHash}`);

      // Esperar confirmaciones (en producción esto sería asíncrono)
      const receipt = await this.waitForConfirmation(txHash);

      // Actualizar estado a completed
      transaction.status = 'completed';
      transaction.metadata.confirmedAt = new Date();
      transaction.metadata.blockNumber = receipt.blockNumber;
      transaction.metadata.gasUsed = receipt.gasUsed.toString();
      await transaction.save();

      console.log(`✅ Withdrawal completed for user ${user.name}`);

      // Enviar fee a treasury wallet
      let feeTxHash = null;
      if (fee > 0) {
        try {
          feeTxHash = await this.sendFeeToTreasury(currency, fee, user._id);
          console.log(`💰 Fee sent to treasury: ${feeTxHash}`);
          
          // Registrar el fee en metadata
          transaction.metadata.feeTxHash = feeTxHash;
          transaction.metadata.feesSentToTreasury = true;
          await transaction.save();
        } catch (feeError) {
          console.error(`⚠️  Failed to send fee to treasury:`, feeError.message);
          // No revertimos el withdrawal principal si falla el envío del fee
          transaction.metadata.feesSentToTreasury = false;
          transaction.metadata.feeError = feeError.message;
          await transaction.save();
        }
      }

      return {
        success: true,
        transaction: transaction,
        txHash: txHash,
        feeTxHash: feeTxHash
      };

    } catch (error) {
      console.error(`❌ Withdrawal failed for user ${user.name}:`, error);

      // Revertir el balance del usuario
      const balanceEntry = user.balances.find(b => b.currency === currency);
      balanceEntry.amount += totalRequired;
      await user.save();

      // Marcar transacción como fallida
      transaction.status = 'failed';
      transaction.metadata.error = error.message;
      transaction.metadata.failedAt = new Date();
      await transaction.save();

      throw error;
    }
  }

  /**
   * Envía tokens a la blockchain
   */
  async sendToBlockchain(currency, amount, destinationAddress) {
    const contract = this.getContract(currency);
    const decimals = currency === 'USDT-ARB' ? 6 : 6;
    
    // Convertir a unidades de la blockchain
    const amountInUnits = ethers.parseUnits(amount.toString(), decimals);

    console.log(`🔄 Sending ${amount} ${currency} to ${destinationAddress}...`);

    // Estimar gas primero
    const gasEstimate = await contract.transfer.estimateGas(
      destinationAddress,
      amountInUnits
    );

    console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);

    // Enviar transacción
    const tx = await contract.transfer(destinationAddress, amountInUnits, {
      gasLimit: gasEstimate * BigInt(120) / BigInt(100) // 20% buffer
    });

    console.log(`⏳ Transaction submitted: ${tx.hash}`);

    return tx.hash;
  }

  /**
   * Envía el fee a la treasury wallet
   */
  async sendFeeToTreasury(currency, feeAmount, userId) {
    const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS;
    
    if (!treasuryAddress) {
      throw new Error('Treasury wallet address not configured');
    }

    console.log(`💰 Sending ${feeAmount} ${currency} fee to treasury: ${treasuryAddress}`);

    const contract = this.getContract(currency);
    const decimals = currency === 'USDT-ARB' ? 6 : 6;
    
    // Convertir a unidades de la blockchain
    const feeInUnits = ethers.parseUnits(feeAmount.toString(), decimals);

    // Estimar gas
    const gasEstimate = await contract.transfer.estimateGas(
      treasuryAddress,
      feeInUnits
    );

    // Enviar transacción
    const tx = await contract.transfer(treasuryAddress, feeInUnits, {
      gasLimit: gasEstimate * BigInt(120) / BigInt(100) // 20% buffer
    });

    console.log(`⏳ Fee transaction submitted: ${tx.hash}`);

    // Crear registro de transacción de fee
    await Transaction.create({
      user: userId,
      type: 'withdrawal',
      currency: currency,
      amount: feeAmount,
      status: 'completed',
      metadata: {
        isFee: true,
        destinationAddress: treasuryAddress,
        txHash: tx.hash,
        sentAt: new Date(),
        description: 'Withdrawal fee sent to treasury'
      }
    });

    return tx.hash;
  }

  /**
   * Espera la confirmación de una transacción
   */
  async waitForConfirmation(txHash, requiredConfirmations = 2) {
    console.log(`⏳ Waiting for ${requiredConfirmations} confirmations...`);
    
    const receipt = await this.provider.waitForTransaction(txHash, requiredConfirmations);
    
    if (receipt.status === 0) {
      throw new Error('Transaction failed on blockchain');
    }

    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    return receipt;
  }

  /**
   * Obtiene el balance de la hot wallet
   */
  async getHotWalletBalances() {
    this.checkHotWalletConfiguration();

    const pyusdBalance = await this.pyusdContract.balanceOf(this.hotWallet.address);
    const usdtBalance = await this.usdtContract.balanceOf(this.hotWallet.address);
    const ethBalance = await this.provider.getBalance(this.hotWallet.address);

    return {
      address: this.hotWallet.address,
      balances: {
        PYUSD: parseFloat(ethers.formatUnits(pyusdBalance, 6)),
        USDT: parseFloat(ethers.formatUnits(usdtBalance, 6)),
        ETH: parseFloat(ethers.formatEther(ethBalance))
      }
    };
  }

  /**
   * Estima el costo de gas para un retiro
   */
  async estimateWithdrawalCost(currency, amount, destinationAddress) {
    const contract = this.getContract(currency);
    const decimals = currency === 'USDT-ARB' ? 6 : 6;
    const amountInUnits = ethers.parseUnits(amount.toString(), decimals);

    const gasEstimate = await contract.transfer.estimateGas(
      destinationAddress,
      amountInUnits
    );

    const feeData = await this.provider.getFeeData();
    const gasCost = gasEstimate * feeData.gasPrice;

    return {
      gasEstimate: gasEstimate.toString(),
      gasPrice: ethers.formatUnits(feeData.gasPrice, 'gwei'),
      gasCostETH: parseFloat(ethers.formatEther(gasCost)),
      fee: this.withdrawalFees[currency]
    };
  }
}

// Instancia singleton
let withdrawalService = null;

/**
 * Obtiene la instancia del servicio de withdrawal
 */
function getWithdrawalService() {
  if (!withdrawalService) {
    withdrawalService = new WithdrawalService();
  }
  return withdrawalService;
}

module.exports = {
  WithdrawalService,
  getWithdrawalService
};

