const { ethers } = require('ethers');
const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');

/**
 * Blockchain Monitor Service
 * 
 * Este servicio monitorea las direcciones de los usuarios para detectar depósitos entrantes.
 * Puede ejecutarse como un cron job o servicio en segundo plano.
 */

// ERC20 ABI para monitorear transferencias de tokens
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// Configuración de contratos en Arbitrum
const ARBITRUM_CONTRACTS = {
  PYUSD: '0x46850ad61c2b7d64d08c9c754f45254596696984', // PYUSD en Arbitrum Mainnet
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
};

// Configuración de RPCs
const RPC_ENDPOINTS = {
  arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  bitcoin: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api' // API pública
};

/**
 * Monitor de depósitos en Arbitrum (PYUSD y USDT)
 */
class ArbitrumMonitor {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.arbitrum);
    this.pyusdContract = new ethers.Contract(ARBITRUM_CONTRACTS.PYUSD, ERC20_ABI, this.provider);
    this.usdtContract = new ethers.Contract(ARBITRUM_CONTRACTS.USDT, ERC20_ABI, this.provider);
    this.lastCheckedBlock = null;
  }

  /**
   * Inicia el monitoreo de eventos de transferencia
   */
  async startMonitoring() {
    console.log('🔍 Starting Arbitrum monitoring...');

    // Obtener el bloque actual
    this.lastCheckedBlock = await this.provider.getBlockNumber();
    console.log(`Starting from block ${this.lastCheckedBlock}`);

    // Monitorear PYUSD
    this.pyusdContract.on('Transfer', async (from, to, value, event) => {
      await this.handleTransfer('PYUSD-ARB', to, value, event);
    });

    // Monitorear USDT
    this.usdtContract.on('Transfer', async (from, to, value, event) => {
      await this.handleTransfer('USDT-ARB', to, value, event);
    });

    console.log('✅ Arbitrum monitoring active');
  }

  /**
   * Maneja una transferencia detectada
   */
  async handleTransfer(currency, to, value, event) {
    try {
      // Buscar si la dirección pertenece a algún usuario
      const user = await User.findOne({ 
        arbitrumAddress: to.toLowerCase() 
      });

      if (!user) {
        // No es una dirección de nuestro sistema
        return;
      }

      console.log(`💰 Deposit detected for user ${user.name}:`);
      console.log(`   Currency: ${currency}`);
      console.log(`   Amount: ${ethers.formatUnits(value, currency === 'USDT-ARB' ? 6 : 6)}`);
      console.log(`   TX Hash: ${event.log.transactionHash}`);

      // Obtener decimales del token
      const decimals = currency === 'USDT-ARB' ? 6 : 6; // USDT y PYUSD usan 6 decimales
      const amount = parseFloat(ethers.formatUnits(value, decimals));

      // Verificar confirmaciones
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - event.log.blockNumber;

      // Actualizar balance y crear transacción
      await this.processDeposit(user, currency, amount, event.log.transactionHash, confirmations);

    } catch (error) {
      console.error('Error handling transfer:', error);
    }
  }

  /**
   * Procesa un depósito confirmado
   */
  async processDeposit(user, currency, amount, txHash, confirmations) {
    const requiredConfirmations = 12;

    // Verificar si ya existe una transacción con este hash
    const existingTx = await Transaction.findOne({
      'metadata.txHash': txHash,
      user: user._id
    });

    if (existingTx) {
      // Actualizar confirmaciones si es necesario
      if (existingTx.status === 'pending' && confirmations >= requiredConfirmations) {
        existingTx.status = 'completed';
        existingTx.metadata.confirmations = confirmations;
        existingTx.metadata.processedAt = new Date();
        await existingTx.save();

        // Actualizar balance
        const balanceEntry = user.balances.find(b => b.currency === currency);
        if (balanceEntry) {
          balanceEntry.amount += amount;
          await user.save();
          console.log(`✅ Deposit confirmed and credited to ${user.name}`);
        }
      }
      return;
    }

    // Crear nueva transacción
    const status = confirmations >= requiredConfirmations ? 'completed' : 'pending';
    
    const transaction = await Transaction.create({
      user: user._id,
      type: 'deposit',
      currency: currency,
      amount: amount,
      status: status,
      metadata: {
        txHash: txHash,
        confirmations: confirmations,
        requiredConfirmations: requiredConfirmations,
        detectedAt: new Date(),
        processedAt: status === 'completed' ? new Date() : null
      }
    });

    // Si tiene suficientes confirmaciones, actualizar balance
    if (status === 'completed') {
      const balanceEntry = user.balances.find(b => b.currency === currency);
      if (balanceEntry) {
        balanceEntry.amount += amount;
        await user.save();
        console.log(`✅ Deposit credited to ${user.name}`);
      }
    } else {
      console.log(`⏳ Deposit pending confirmations for ${user.name} (${confirmations}/${requiredConfirmations})`);
    }
  }

  /**
   * Detiene el monitoreo
   */
  stopMonitoring() {
    this.pyusdContract.removeAllListeners('Transfer');
    this.usdtContract.removeAllListeners('Transfer');
    console.log('🛑 Arbitrum monitoring stopped');
  }

  /**
   * Verifica manualmente los balances de todos los usuarios
   * Útil para sincronización inicial o recuperación
   * @param {boolean} updateDB - Si true, actualiza los balances en la base de datos
   */
  async syncAllBalances(updateDB = false) {
    console.log('🔄 Syncing all user balances...');
    
    const users = await User.find({ 
      arbitrumAddress: { $exists: true, $ne: null } 
    });

    const results = [];

    for (const user of users) {
      try {
        // Check PYUSD balance
        const pyusdBalance = await this.pyusdContract.balanceOf(user.arbitrumAddress);
        const pyusdAmount = parseFloat(ethers.formatUnits(pyusdBalance, 6));
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check USDT balance
        const usdtBalance = await this.usdtContract.balanceOf(user.arbitrumAddress);
        const usdtAmount = parseFloat(ethers.formatUnits(usdtBalance, 6));

        const dbPyusd = user.balances.find(b => b.currency === 'PYUSD-ARB')?.amount || 0;
        const dbUsdt = user.balances.find(b => b.currency === 'USDT-ARB')?.amount || 0;

        console.log(`User ${user.name}:`);
        console.log(`  On-chain PYUSD: ${pyusdAmount}, DB: ${dbPyusd}`);
        console.log(`  On-chain USDT: ${usdtAmount}, DB: ${dbUsdt}`);

        const userResult = {
          user: user.name,
          address: user.arbitrumAddress,
          pyusd: {
            onChain: pyusdAmount,
            database: dbPyusd,
            synced: pyusdAmount === dbPyusd
          },
          usdt: {
            onChain: usdtAmount,
            database: dbUsdt,
            synced: usdtAmount === dbUsdt
          }
        };

        // Update database if requested
        if (updateDB) {
          let updated = false;
          
          const pyusdEntry = user.balances.find(b => b.currency === 'PYUSD-ARB');
          if (pyusdEntry && pyusdEntry.amount !== pyusdAmount) {
            // SAFETY: Only update if on-chain balance is HIGHER than DB
            // This prevents overwriting if a deposit just came in
            if (pyusdAmount > pyusdEntry.amount) {
              console.log(`  ⚠️ On-chain PYUSD (${pyusdAmount}) > DB (${pyusdEntry.amount}) - likely missed deposit`);
              pyusdEntry.amount = pyusdAmount;
              updated = true;
              userResult.pyusd.action = 'increased';
            } else if (pyusdAmount < pyusdEntry.amount) {
              console.log(`  ⚠️ On-chain PYUSD (${pyusdAmount}) < DB (${pyusdEntry.amount}) - likely a sweep occurred`);
              pyusdEntry.amount = pyusdAmount;
              updated = true;
              userResult.pyusd.action = 'decreased';
            }
          }
          
          const usdtEntry = user.balances.find(b => b.currency === 'USDT-ARB');
          if (usdtEntry && usdtEntry.amount !== usdtAmount) {
            // SAFETY: Only update if on-chain balance is HIGHER than DB
            if (usdtAmount > usdtEntry.amount) {
              console.log(`  ⚠️ On-chain USDT (${usdtAmount}) > DB (${usdtEntry.amount}) - likely missed deposit`);
              usdtEntry.amount = usdtAmount;
              updated = true;
              userResult.usdt.action = 'increased';
            } else if (usdtAmount < usdtEntry.amount) {
              console.log(`  ⚠️ On-chain USDT (${usdtAmount}) < DB (${usdtEntry.amount}) - likely a sweep occurred`);
              usdtEntry.amount = usdtAmount;
              updated = true;
              userResult.usdt.action = 'decreased';
            }
          }
          
          if (updated) {
            await user.save();
            userResult.updated = true;
          }
        }

        results.push(userResult);

        // Small delay between users
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error syncing balance for ${user.name}:`, error.message);
        results.push({
          user: user.name,
          error: error.message
        });
      }
    }

    console.log('✅ Balance sync completed');
    return results;
  }
}

/**
 * Monitor de depósitos en Bitcoin
 */
class BitcoinMonitor {
  constructor() {
    this.apiUrl = RPC_ENDPOINTS.bitcoin;
    this.checkInterval = 60000; // 1 minuto
    this.intervalId = null;
  }

  /**
   * Inicia el monitoreo de direcciones Bitcoin
   */
  async startMonitoring() {
    console.log('🔍 Starting Bitcoin monitoring...');

    this.intervalId = setInterval(async () => {
      await this.checkAllAddresses();
    }, this.checkInterval);

    // Primera verificación inmediata
    await this.checkAllAddresses();

    console.log('✅ Bitcoin monitoring active');
  }

  /**
   * Verifica todas las direcciones Bitcoin de los usuarios
   */
  async checkAllAddresses() {
    try {
      const users = await User.find({ 
        bitcoinAddress: { $exists: true, $ne: null } 
      });

      for (const user of users) {
        await this.checkAddress(user);
      }
    } catch (error) {
      console.error('Error checking Bitcoin addresses:', error);
    }
  }

  /**
   * Verifica una dirección específica
   */
  async checkAddress(user) {
    try {
      // Obtener transacciones de la dirección
      const response = await fetch(`${this.apiUrl}/address/${user.bitcoinAddress}/txs`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const txs = await response.json();

      // Procesar cada transacción
      for (const tx of txs) {
        await this.processBitcoinTx(user, tx);
      }

    } catch (error) {
      console.error(`Error checking Bitcoin address for ${user.name}:`, error.message);
    }
  }

  /**
   * Procesa una transacción Bitcoin
   */
  async processBitcoinTx(user, tx) {
    try {
      // Verificar si ya procesamos esta transacción
      const existingTx = await Transaction.findOne({
        'metadata.txHash': tx.txid,
        user: user._id
      });

      if (existingTx) {
        return; // Ya procesada
      }

      // Calcular el monto recibido por el usuario
      let amountReceived = 0;
      
      for (const vout of tx.vout) {
        if (vout.scriptpubkey_address === user.bitcoinAddress) {
          amountReceived += vout.value; // en satoshis
        }
      }

      if (amountReceived === 0) {
        return; // No recibió nada en esta tx
      }

      console.log(`💰 Bitcoin deposit detected for user ${user.name}:`);
      console.log(`   Amount: ${amountReceived} satoshis`);
      console.log(`   TX Hash: ${tx.txid}`);

      // Verificar confirmaciones
      const confirmations = tx.status.confirmed ? tx.status.block_height : 0;
      const requiredConfirmations = 3;
      const status = confirmations >= requiredConfirmations ? 'completed' : 'pending';

      // Crear transacción
      const transaction = await Transaction.create({
        user: user._id,
        type: 'deposit',
        currency: 'SAT-BTC',
        amount: amountReceived,
        status: status,
        metadata: {
          txHash: tx.txid,
          confirmations: confirmations,
          requiredConfirmations: requiredConfirmations,
          detectedAt: new Date(),
          processedAt: status === 'completed' ? new Date() : null
        }
      });

      // Si está confirmado, actualizar balance
      if (status === 'completed') {
        const balanceEntry = user.balances.find(b => b.currency === 'SAT-BTC');
        if (balanceEntry) {
          balanceEntry.amount += amountReceived;
          await user.save();
          console.log(`✅ Bitcoin deposit credited to ${user.name}`);
        }
      }

    } catch (error) {
      console.error('Error processing Bitcoin tx:', error);
    }
  }

  /**
   * Detiene el monitoreo
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Bitcoin monitoring stopped');
    }
  }
}

/**
 * Servicio de Sweep - Concentra fondos en cuentas maestras
 * Este servicio mueve los fondos de las cuentas de usuarios a cuentas de holding
 * usando NEAR MPC para firmar y un Gas Sponsor Wallet para pagar gas fees
 */
class SweepService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.arbitrum);
    this.treasuryAddress = process.env.TREASURY_WALLET_ADDRESS;
    
    // Gas Sponsor Wallet - solo para pagar gas fees
    const gasSponsorKey = process.env.GAS_SPONSOR_PRIVATE_KEY;
    if (gasSponsorKey) {
      this.gasSponsorWallet = new ethers.Wallet(gasSponsorKey, this.provider);
      console.log(`⛽ Gas Sponsor Wallet initialized: ${this.gasSponsorWallet.address}`);
    } else {
      console.warn('⚠️ GAS_SPONSOR_PRIVATE_KEY not configured - sweep will not work');
      this.gasSponsorWallet = null;
    }

    // Contratos ERC20
    this.contracts = {
      'PYUSD-ARB': new ethers.Contract(ARBITRUM_CONTRACTS.PYUSD, [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)'
      ], this.provider),
      'USDT-ARB': new ethers.Contract(ARBITRUM_CONTRACTS.USDT, [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)'
      ], this.provider)
    };

    // Umbrales de sweep (cuando acumular sweep)
    this.sweepThreshold = {
      'PYUSD-ARB': parseFloat(process.env.SWEEP_THRESHOLD_PYUSD || '100'),
      'USDT-ARB': parseFloat(process.env.SWEEP_THRESHOLD_USDT || '100'),
      'SAT-BTC': parseInt(process.env.SWEEP_THRESHOLD_BTC || '1000000') // 0.01 BTC
    };

    // Configuración de liquidez para sweep inteligente
    this.minTreasuryReserve = {
      'PYUSD-ARB': parseFloat(process.env.MIN_TREASURY_RESERVE_PYUSD || '10000'),
      'USDT-ARB': parseFloat(process.env.MIN_TREASURY_RESERVE_USDT || '10000')
    };
  }

  /**
   * Verifica si es necesario hacer sweep basado en liquidez de treasury
   */
  async shouldSweepForLiquidity() {
    if (!this.treasuryAddress) {
      console.log('⚠️ Treasury address not configured, skipping liquidity check');
      return { shouldSweep: false, currencies: [] };
    }

    const needsSweep = [];

    try {
      // Verificar balance de PYUSD en treasury
      const pyusdBalance = await this.contracts['PYUSD-ARB'].balanceOf(this.treasuryAddress);
      const pyusdAmount = parseFloat(ethers.formatUnits(pyusdBalance, 6));
      
      if (pyusdAmount < this.minTreasuryReserve['PYUSD-ARB']) {
        needsSweep.push({
          currency: 'PYUSD-ARB',
          currentBalance: pyusdAmount,
          targetBalance: this.minTreasuryReserve['PYUSD-ARB'],
          deficit: this.minTreasuryReserve['PYUSD-ARB'] - pyusdAmount
        });
      }

      // Verificar balance de USDT en treasury
      const usdtBalance = await this.contracts['USDT-ARB'].balanceOf(this.treasuryAddress);
      const usdtAmount = parseFloat(ethers.formatUnits(usdtBalance, 6));
      
      if (usdtAmount < this.minTreasuryReserve['USDT-ARB']) {
        needsSweep.push({
          currency: 'USDT-ARB',
          currentBalance: usdtAmount,
          targetBalance: this.minTreasuryReserve['USDT-ARB'],
          deficit: this.minTreasuryReserve['USDT-ARB'] - usdtAmount
        });
      }

      if (needsSweep.length > 0) {
        console.log('💰 Treasury needs liquidity:');
        needsSweep.forEach(item => {
          console.log(`   ${item.currency}: ${item.currentBalance} (need ${item.targetBalance}, deficit: ${item.deficit})`);
        });
      }

      return {
        shouldSweep: needsSweep.length > 0,
        currencies: needsSweep.map(item => item.currency)
      };

    } catch (error) {
      console.error('Error checking treasury liquidity:', error);
      return { shouldSweep: false, currencies: [] };
    }
  }

  /**
   * Verifica y ejecuta sweeps necesarios (threshold-based)
   */
  async checkAndSweep() {
    console.log('🧹 Checking for sweep opportunities...');

    if (!this.gasSponsorWallet) {
      console.log('⚠️ Gas sponsor wallet not configured. Cannot perform sweep.');
      return { success: false, message: 'Gas sponsor wallet not configured' };
    }

    if (!this.treasuryAddress) {
      console.log('⚠️ Treasury address not configured. Cannot perform sweep.');
      return { success: false, message: 'Treasury address not configured' };
    }

    const users = await User.find({
      arbitrumAddress: { $exists: true, $ne: null }
    });

    let sweepCount = 0;
    const results = [];

    for (const user of users) {
      for (const balance of user.balances) {
        // Solo sweep de tokens ERC20 por ahora (no Bitcoin)
        if (!['PYUSD-ARB', 'USDT-ARB'].includes(balance.currency)) {
          continue;
        }

        if (balance.amount >= this.sweepThreshold[balance.currency]) {
          try {
            const result = await this.sweepUserFunds(user, balance.currency, balance.amount);
            sweepCount++;
            results.push(result);
          } catch (error) {
            console.error(`Failed to sweep ${balance.currency} from ${user.name}:`, error.message);
            results.push({
              success: false,
              user: user.name,
              currency: balance.currency,
              error: error.message
            });
          }
        }
      }
    }

    console.log(`✅ Sweep check completed. Swept ${sweepCount} addresses.`);
    return { success: true, sweepCount, results };
  }

  /**
   * Sweep inteligente basado en liquidez
   */
  async smartSweep() {
    console.log('🧠 Running smart liquidity-driven sweep...');

    const liquidityCheck = await this.shouldSweepForLiquidity();
    
    if (!liquidityCheck.shouldSweep) {
      console.log('✅ Treasury has sufficient liquidity. No sweep needed.');
      return { success: true, message: 'No sweep needed', sweepCount: 0 };
    }

    console.log(`🎯 Treasury needs liquidity for: ${liquidityCheck.currencies.join(', ')}`);

    // Sweep específicamente las monedas que necesitan liquidez
    const users = await User.find({
      arbitrumAddress: { $exists: true, $ne: null }
    });

    let sweepCount = 0;
    const results = [];

    for (const user of users) {
      for (const balance of user.balances) {
        // Solo sweep las monedas que necesitan liquidez
        if (!liquidityCheck.currencies.includes(balance.currency)) {
          continue;
        }

        // Sweep si tiene algo significativo (threshold más bajo para liquidez urgente)
        const urgentThreshold = this.sweepThreshold[balance.currency] * 0.5;
        
        if (balance.amount >= urgentThreshold) {
          try {
            const result = await this.sweepUserFunds(user, balance.currency, balance.amount);
            sweepCount++;
            results.push(result);
          } catch (error) {
            console.error(`Failed to sweep ${balance.currency} from ${user.name}:`, error.message);
            results.push({
              success: false,
              user: user.name,
              currency: balance.currency,
              error: error.message
            });
          }
        }
      }
    }

    console.log(`✅ Smart sweep completed. Swept ${sweepCount} addresses.`);
    return { success: true, sweepCount, results };
  }

  /**
   * Ejecuta un sweep de fondos de usuario a treasury usando MPC + Gas Sponsor
   */
  async sweepUserFunds(user, currency, amount) {
    try {
      console.log(`🧹 Sweeping ${amount} ${currency} from ${user.name} (${user.arbitrumAddress}) to treasury`);

      // Verificar que tengamos todo lo necesario
      if (!this.gasSponsorWallet) {
        throw new Error('Gas sponsor wallet not configured');
      }

      if (!this.treasuryAddress) {
        throw new Error('Treasury address not configured');
      }

      const contract = this.contracts[currency];
      if (!contract) {
        throw new Error(`Contract not found for currency: ${currency}`);
      }

      // 1. Verificar balance on-chain del usuario
      const onChainBalance = await contract.balanceOf(user.arbitrumAddress);
      const onChainAmount = parseFloat(ethers.formatUnits(onChainBalance, 6));

      console.log(`   On-chain balance: ${onChainAmount} ${currency}`);
      console.log(`   DB balance: ${amount} ${currency}`);

      if (onChainAmount < 1) {
        console.log(`   ⚠️ Insufficient on-chain balance, skipping sweep`);
        
        // Update DB balance to match on-chain reality to prevent infinite retries
        const balanceEntry = user.balances.find(b => b.currency === currency);
        if (balanceEntry && balanceEntry.amount > 0) {
          console.log(`   📝 Updating DB balance from ${balanceEntry.amount} to 0`);
          balanceEntry.amount = 0;
          await user.save();
        }
        
        return { success: false, reason: 'Insufficient on-chain balance' };
      }

      // Usar el balance on-chain (más confiable)
      const sweepAmount = onChainAmount;
      const sweepAmountInUnits = ethers.parseUnits(sweepAmount.toString(), 6);

      // 2. Estimar gas necesario
      const gasEstimate = await contract.transfer.estimateGas(
        this.treasuryAddress,
        sweepAmountInUnits,
        { from: user.arbitrumAddress }
      );
      
      const feeData = await this.provider.getFeeData();
      const gasNeeded = gasEstimate * BigInt(120) / BigInt(100); // 20% buffer
      const ethNeeded = gasNeeded * feeData.gasPrice;

      console.log(`   ⛽ Gas estimate: ${gasEstimate.toString()}`);
      console.log(`   💰 ETH needed: ${ethers.formatEther(ethNeeded)} ETH`);

      // 3. Verificar balance de ETH del usuario
      const userEthBalance = await this.provider.getBalance(user.arbitrumAddress);
      
      if (userEthBalance < ethNeeded) {
        console.log(`   📤 Sending ETH for gas from sponsor wallet...`);
        
        // Enviar ETH desde gas sponsor wallet
        // Let ethers.js automatically determine the best gas settings
        const gasTx = await this.gasSponsorWallet.sendTransaction({
          to: user.arbitrumAddress,
          value: ethNeeded
          // Don't specify gasLimit or type - let ethers handle it
        });

        console.log(`   ⏳ Waiting for gas transfer: ${gasTx.hash}`);
        await gasTx.wait();
        console.log(`   ✅ Gas transferred successfully`);
      } else {
        console.log(`   ✅ User address already has sufficient ETH for gas`);
      }

      // 4. Preparar la transacción de transferencia de tokens
      const { getAdapter } = require('./nearService');
      const phoneNumberClean = user.phoneNumber.replace(/\D/g, '');
      const derivationPath = `arb-${phoneNumberClean}`;

      console.log(`   🔐 Getting MPC adapter for path: ${derivationPath}`);
      const adapter = await getAdapter(derivationPath);

      // 5. Construir y enviar la transacción con MPC
      console.log(`   📝 Building transfer transaction...`);
      
      const tx = await contract.transfer.populateTransaction(
        this.treasuryAddress,
        sweepAmountInUnits
      );

      // Agregar datos de la transacción
      tx.from = user.arbitrumAddress;
      tx.chainId = 42161; // Arbitrum One
      tx.gasLimit = gasNeeded;
      tx.gasPrice = feeData.gasPrice;
      tx.nonce = await this.provider.getTransactionCount(user.arbitrumAddress);

      console.log(`   🔐 Signing and sending transaction with MPC...`);
      const signedTx = await adapter.signAndSendTransaction(tx);

      console.log(`   ⏳ Transaction sent: ${signedTx.hash}`);
      console.log(`   ⏳ Waiting for confirmation...`);

      const receipt = await signedTx.wait();

      console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);

      // 6. Actualizar balance en DB (set to 0 ya que se barrió todo)
      const balanceEntry = user.balances.find(b => b.currency === currency);
      balanceEntry.amount = 0;
      await user.save();

      // 7. Crear registro de transacción
      await Transaction.create({
        user: user._id,
        type: 'withdrawal',
        currency: currency,
        amount: sweepAmount,
        status: 'completed',
        metadata: {
          sweepToTreasury: true,
          treasuryAddress: this.treasuryAddress,
          txHash: signedTx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          gasPaid: ethers.formatEther(ethNeeded),
          initiatedAt: new Date(),
          completedAt: new Date()
        }
      });

      console.log(`   ✅ Sweep completed for ${user.name}`);

      return {
        success: true,
        user: user.name,
        currency: currency,
        amount: sweepAmount,
        txHash: signedTx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error(`   ❌ Error sweeping funds for ${user.name}:`, error.message);
      
      // Check if it's an RPC rate limit error
      const isRateLimitError = error.message.includes('429') || 
                               error.message.includes('rate limit') || 
                               error.message.includes('Too Many Requests') ||
                               error.message.includes('exceeded maximum retry');
      
      if (isRateLimitError) {
        console.log(`   ⚠️ RPC rate limit hit - will retry on next sweep cycle`);
        // Don't create a failed transaction for rate limit errors
        // Just return the error without throwing
        return {
          success: false,
          user: user.name,
          currency: currency,
          error: 'RPC rate limit - will retry later'
        };
      }
      
      // For other errors, create a failed transaction record
      await Transaction.create({
        user: user._id,
        type: 'withdrawal',
        currency: currency,
        amount: amount,
        status: 'failed',
        metadata: {
          sweepToTreasury: true,
          treasuryAddress: this.treasuryAddress,
          error: error.message,
          initiatedAt: new Date(),
          failedAt: new Date()
        }
      });

      throw error;
    }
  }

  /**
   * Obtiene estadísticas de sweep
   */
  async getSweepStats() {
    const users = await User.find({
      arbitrumAddress: { $exists: true, $ne: null }
    });

    const stats = {
      totalUsers: users.length,
      sweepableBalances: {
        'PYUSD-ARB': { count: 0, totalAmount: 0 },
        'USDT-ARB': { count: 0, totalAmount: 0 }
      },
      gasSponsorBalance: null,
      treasuryBalances: {}
    };

    // Contar balances que están sobre el threshold
    for (const user of users) {
      for (const balance of user.balances) {
        if (['PYUSD-ARB', 'USDT-ARB'].includes(balance.currency)) {
          if (balance.amount >= this.sweepThreshold[balance.currency]) {
            stats.sweepableBalances[balance.currency].count++;
            stats.sweepableBalances[balance.currency].totalAmount += balance.amount;
          }
        }
      }
    }

    // Balance del gas sponsor
    if (this.gasSponsorWallet) {
      const gasSponsorEth = await this.provider.getBalance(this.gasSponsorWallet.address);
      stats.gasSponsorBalance = {
        address: this.gasSponsorWallet.address,
        eth: parseFloat(ethers.formatEther(gasSponsorEth))
      };
    }

    // Balances del treasury
    if (this.treasuryAddress) {
      const pyusdBalance = await this.contracts['PYUSD-ARB'].balanceOf(this.treasuryAddress);
      const usdtBalance = await this.contracts['USDT-ARB'].balanceOf(this.treasuryAddress);
      
      stats.treasuryBalances = {
        address: this.treasuryAddress,
        PYUSD: parseFloat(ethers.formatUnits(pyusdBalance, 6)),
        USDT: parseFloat(ethers.formatUnits(usdtBalance, 6))
      };
    }

    return stats;
  }
}

// Instancias singleton
let arbitrumMonitor = null;
let bitcoinMonitor = null;
let sweepService = null;
let sweepIntervalId = null;

/**
 * Inicia todos los servicios de monitoreo
 */
async function startMonitoring() {
  if (!arbitrumMonitor) {
    arbitrumMonitor = new ArbitrumMonitor();
    await arbitrumMonitor.startMonitoring();
  }

  if (!bitcoinMonitor) {
    bitcoinMonitor = new BitcoinMonitor();
    await bitcoinMonitor.startMonitoring();
  }

  if (!sweepService) {
    sweepService = new SweepService();
    
    // Configurar sweep automático
    const sweepMode = process.env.SWEEP_MODE || 'smart'; // 'smart', 'threshold', or 'disabled'
    const sweepInterval = parseInt(process.env.SWEEP_INTERVAL_HOURS || '6') * 3600000; // Default: 6 horas
    
    if (sweepMode !== 'disabled') {
      console.log(`🧹 Configuring automatic sweep (mode: ${sweepMode}, interval: ${sweepInterval / 3600000} hours)`);
      
      sweepIntervalId = setInterval(async () => {
        try {
          if (sweepMode === 'smart') {
            console.log('🧠 Running scheduled smart sweep...');
            await sweepService.smartSweep();
          } else if (sweepMode === 'threshold') {
            console.log('🧹 Running scheduled threshold-based sweep...');
            await sweepService.checkAndSweep();
          }
        } catch (error) {
          console.error('Error in scheduled sweep:', error);
        }
      }, sweepInterval);
      
      console.log(`✅ Automatic sweep configured (${sweepMode} mode)`);
    } else {
      console.log('⚠️ Automatic sweep disabled. Use manual endpoints to trigger sweeps.');
    }
  }

  console.log('✅ All monitoring services started');
}

/**
 * Detiene todos los servicios de monitoreo
 */
function stopMonitoring() {
  if (arbitrumMonitor) {
    arbitrumMonitor.stopMonitoring();
  }

  if (bitcoinMonitor) {
    bitcoinMonitor.stopMonitoring();
  }

  if (sweepIntervalId) {
    clearInterval(sweepIntervalId);
    sweepIntervalId = null;
    console.log('🛑 Automatic sweep stopped');
  }

  console.log('✅ All monitoring services stopped');
}

module.exports = {
  ArbitrumMonitor,
  BitcoinMonitor,
  SweepService,
  startMonitoring,
  stopMonitoring,
  getMonitors: () => ({ arbitrumMonitor, bitcoinMonitor, sweepService })
};

