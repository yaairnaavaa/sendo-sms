#!/usr/bin/env node

/**
 * Script para verificar la configuración de la Hot Wallet para Withdrawals
 * 
 * Uso:
 *   node scripts/verifyHotWallet.js
 * 
 * Este script verifica:
 * - Que la variable de entorno esté configurada
 * - Que el formato de la clave privada sea válido
 * - Los balances de la hot wallet (PYUSD, USDT, ETH)
 * - Que tenga suficiente ETH para gas
 */

const { ethers } = require('ethers');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración
const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
const PYUSD_CONTRACT = '0x46850ad61c2b7d64d08c9c754f45254596696984'; // PYUSD en Arbitrum Mainnet
const USDT_CONTRACT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

async function verifyHotWallet() {
  console.log('\n🔍 Verificando configuración de Hot Wallet para Withdrawals...\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Verificar variable de entorno
  console.log('1️⃣  Verificando variable de entorno...');
  const privateKey = process.env.WITHDRAWAL_HOT_WALLET_PRIVATE_KEY;

  if (!privateKey) {
    console.log('   ❌ ERROR: WITHDRAWAL_HOT_WALLET_PRIVATE_KEY no está configurada');
    console.log('   📝 Solución: Agrega esta línea a tu archivo .env:');
    console.log('   WITHDRAWAL_HOT_WALLET_PRIVATE_KEY=0xyour_private_key_here\n');
    process.exit(1);
  }

  console.log('   ✅ Variable de entorno configurada\n');

  // 2. Verificar formato de clave privada
  console.log('2️⃣  Verificando formato de clave privada...');
  let wallet;
  
  try {
    // Crear wallet desde la clave privada
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
    wallet = new ethers.Wallet(privateKey, provider);
    console.log('   ✅ Formato de clave privada válido\n');
  } catch (error) {
    console.log('   ❌ ERROR: Formato de clave privada inválido');
    console.log('   Detalle:', error.message);
    console.log('   📝 La clave debe tener 64 caracteres hex (0-9, a-f)');
    console.log('   Ejemplo: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n');
    process.exit(1);
  }

  // 3. Mostrar dirección
  console.log('3️⃣  Dirección de la Hot Wallet:');
  console.log(`   📍 ${wallet.address}\n`);

  // 4. Verificar conexión a Arbitrum
  console.log('4️⃣  Verificando conexión a Arbitrum...');
  try {
    const blockNumber = await wallet.provider.getBlockNumber();
    console.log(`   ✅ Conectado a Arbitrum (bloque: ${blockNumber})\n`);
  } catch (error) {
    console.log('   ⚠️  Error al conectar con Arbitrum:', error.message);
    console.log('   📝 Verifica tu conexión a internet y RPC_URL\n');
  }

  // 5. Verificar balances
  console.log('5️⃣  Verificando balances de la Hot Wallet...\n');

  try {
    // Balance de ETH
    const ethBalance = await wallet.provider.getBalance(wallet.address);
    const ethFormatted = parseFloat(ethers.formatEther(ethBalance));
    console.log(`   💎 ETH: ${ethFormatted.toFixed(6)} ETH`);
    
    if (ethFormatted < 0.001) {
      console.log('      ⚠️  Balance bajo - necesitas al menos 0.01 ETH para gas');
    } else if (ethFormatted < 0.01) {
      console.log('      ⚠️  Balance bajo - recomendado tener al menos 0.1 ETH');
    } else {
      console.log('      ✅ Balance suficiente para gas');
    }

    // Balance de PYUSD
    let pyusdFormatted = 0;
    try {
      const pyusdContract = new ethers.Contract(PYUSD_CONTRACT, ERC20_ABI, wallet.provider);
      const pyusdBalance = await pyusdContract.balanceOf(wallet.address);
      pyusdFormatted = parseFloat(ethers.formatUnits(pyusdBalance, 6));
      console.log(`\n   💵 PYUSD: ${pyusdFormatted.toFixed(2)} PYUSD`);
      
      if (pyusdFormatted === 0) {
        console.log('      ⚠️  Sin fondos - necesitas PYUSD para procesar retiros');
      } else if (pyusdFormatted < 100) {
        console.log('      ⚠️  Balance bajo - considera agregar más fondos');
      } else {
        console.log('      ✅ Balance adecuado');
      }
    } catch (error) {
      console.log(`\n   💵 PYUSD: Error al verificar`);
      console.log('      ⚠️  No se pudo obtener el balance (puede ser problema de RPC)');
    }

    // Balance de USDT
    let usdtFormatted = 0;
    try {
      const usdtContract = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, wallet.provider);
      const usdtBalance = await usdtContract.balanceOf(wallet.address);
      usdtFormatted = parseFloat(ethers.formatUnits(usdtBalance, 6));
      console.log(`\n   💵 USDT: ${usdtFormatted.toFixed(2)} USDT`);
      
      if (usdtFormatted === 0) {
        console.log('      ⚠️  Sin fondos - necesitas USDT para procesar retiros');
      } else if (usdtFormatted < 100) {
        console.log('      ⚠️  Balance bajo - considera agregar más fondos');
      } else {
        console.log('      ✅ Balance adecuado');
      }
    } catch (error) {
      console.log(`\n   💵 USDT: Error al verificar`);
      console.log('      ⚠️  No se pudo obtener el balance (puede ser problema de RPC)');
    }

  } catch (error) {
    console.log('   ❌ Error general al verificar balances:', error.message);
  }

  // 6. Resumen final
  console.log('\n═══════════════════════════════════════════════════════════════════\n');
  console.log('📊 Resumen de Verificación:\n');
  
  try {
    const ethBalance = await wallet.provider.getBalance(wallet.address);
    const ethFormatted = parseFloat(ethers.formatEther(ethBalance));
    
    const canProcessWithdrawals = ethFormatted >= 0.001;

    if (canProcessWithdrawals) {
      console.log('   ✅ Hot Wallet tiene ETH para gas');
      console.log('   ⚠️  Recuerda fondear con PYUSD/USDT para procesar retiros');
    } else {
      console.log('   ⚠️  Hot Wallet configurada pero necesita fondos');
      console.log('\n   📝 Para fondear tu hot wallet:');
      console.log(`      1. Envía PYUSD a: ${wallet.address}`);
      console.log(`      2. Envía USDT a: ${wallet.address}`);
      console.log(`      3. Envía ETH (min 0.01) a: ${wallet.address}`);
    }

  } catch (error) {
    console.log('   ❌ Error al verificar resumen:', error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════\n');

  // 7. Información adicional
  console.log('📋 Información de Contratos:\n');
  console.log(`   PYUSD Contract: ${PYUSD_CONTRACT}`);
  console.log(`   USDT Contract:  ${USDT_CONTRACT}`);
  console.log(`   Network:        Arbitrum One`);
  console.log(`   RPC:            ${ARBITRUM_RPC}`);
  
  console.log('\n🔗 Links útiles:\n');
  console.log(`   Explorador: https://arbiscan.io/address/${wallet.address}`);
  console.log(`   Agregar PYUSD a Metamask: Token ${PYUSD_CONTRACT}`);
  console.log(`   Agregar USDT a Metamask: Token ${USDT_CONTRACT}`);
  
  console.log('\n✅ Verificación completada!\n');
}

// Ejecutar verificación
verifyHotWallet().catch((error) => {
  console.error('\n❌ Error durante la verificación:', error.message);
  process.exit(1);
});

