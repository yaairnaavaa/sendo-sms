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
   */
  async syncAllBalances() {
    console.log('🔄 Syncing all user balances...');
    
    const users = await User.find({ 
      arbitrumAddress: { $exists: true, $ne: null } 
    });

    for (const user of users) {
      try {
        // Check PYUSD balance
        const pyusdBalance = await this.pyusdContract.balanceOf(user.arbitrumAddress);
        const pyusdAmount = parseFloat(ethers.formatUnits(pyusdBalance, 6));
        
        // Check USDT balance
        const usdtBalance = await this.usdtContract.balanceOf(user.arbitrumAddress);
        const usdtAmount = parseFloat(ethers.formatUnits(usdtBalance, 6));

        console.log(`User ${user.name}:`);
        console.log(`  On-chain PYUSD: ${pyusdAmount}`);
        console.log(`  DB PYUSD: ${user.balances.find(b => b.currency === 'PYUSD-ARB')?.amount || 0}`);
        console.log(`  On-chain USDT: ${usdtAmount}`);
        console.log(`  DB USDT: ${user.balances.find(b => b.currency === 'USDT-ARB')?.amount || 0}`);

      } catch (error) {
        console.error(`Error syncing balance for ${user.name}:`, error.message);
      }
    }

    console.log('✅ Balance sync completed');
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
 */
class SweepService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.arbitrum);
    this.masterWalletAddress = process.env.MASTER_WALLET_ADDRESS;
    this.sweepThreshold = {
      'PYUSD-ARB': 10, // Sweep cuando hay más de 10 PYUSD
      'USDT-ARB': 10,  // Sweep cuando hay más de 10 USDT
      'SAT-BTC': 100000 // Sweep cuando hay más de 100k satoshis (0.001 BTC)
    };
  }

  /**
   * Verifica y ejecuta sweeps necesarios
   */
  async checkAndSweep() {
    console.log('🧹 Checking for sweep opportunities...');

    const users = await User.find({
      $or: [
        { arbitrumAddress: { $exists: true, $ne: null } },
        { bitcoinAddress: { $exists: true, $ne: null } }
      ]
    });

    for (const user of users) {
      for (const balance of user.balances) {
        if (balance.amount >= this.sweepThreshold[balance.currency]) {
          await this.sweepUserFunds(user, balance.currency, balance.amount);
        }
      }
    }

    console.log('✅ Sweep check completed');
  }

  /**
   * Ejecuta un sweep de fondos de usuario a cuenta maestra
   */
  async sweepUserFunds(user, currency, amount) {
    try {
      console.log(`🧹 Sweeping ${amount} ${currency} from ${user.name} to master wallet`);

      // Aquí implementarías la lógica real de transferencia usando NEAR MPC
      // Por ahora, solo registramos la intención

      // TODO: Implementar la firma y envío de transacción usando NEAR MPC
      // 1. Construir la transacción
      // 2. Obtener la firma del MPC
      // 3. Enviar la transacción
      // 4. Actualizar balances

      console.log(`⚠️ Sweep not implemented yet - would transfer ${amount} ${currency}`);

      // Crear registro de transacción
      await Transaction.create({
        user: user._id,
        type: 'withdrawal',
        currency: currency,
        amount: amount,
        status: 'pending',
        metadata: {
          sweepToMaster: true,
          masterWalletAddress: this.masterWalletAddress,
          initiatedAt: new Date()
        }
      });

    } catch (error) {
      console.error(`Error sweeping funds for ${user.name}:`, error);
    }
  }
}

// Instancias singleton
let arbitrumMonitor = null;
let bitcoinMonitor = null;
let sweepService = null;

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
    // Ejecutar sweep cada hora
    setInterval(() => {
      sweepService.checkAndSweep();
    }, 3600000); // 1 hora
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

