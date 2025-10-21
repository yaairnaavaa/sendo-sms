#!/usr/bin/env node

/**
 * Script para generar una nueva Hot Wallet para Withdrawals
 * 
 * Uso:
 *   node scripts/generateHotWallet.js
 * 
 * Este script genera una nueva wallet de Ethereum que puedes usar
 * como hot wallet para procesar retiros.
 * 
 * ⚠️ IMPORTANTE: Guarda la clave privada de forma segura y nunca la compartas.
 */

const { ethers } = require('ethers');

console.log('\n🔐 Generando nueva Hot Wallet para Withdrawals...\n');

// Generar una wallet aleatoria
const wallet = ethers.Wallet.createRandom();

console.log('✅ Wallet generada exitosamente!\n');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('📍 Address (Dirección de la Wallet):');
console.log(`   ${wallet.address}`);
console.log('');
console.log('🔑 Private Key (Clave Privada):');
console.log(`   ${wallet.privateKey}`);
console.log('');
console.log('📝 Mnemonic (Frase de Recuperación):');
console.log(`   ${wallet.mnemonic.phrase}`);
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Agrega esto a tu archivo .env:');
console.log('');
console.log('WITHDRAWAL_HOT_WALLET_PRIVATE_KEY=' + wallet.privateKey);
console.log('');
console.log('⚠️  IMPORTANTE - SEGURIDAD:');
console.log('   1. Guarda la clave privada de forma SEGURA (no la compartas)');
console.log('   2. Guarda la frase mnemonic en un lugar SEPARADO como backup');
console.log('   3. Nunca subas el archivo .env a git');
console.log('   4. Esta wallet SOLO debe usarse para withdrawals');
console.log('');
console.log('💰 Siguiente paso - Fondear la Hot Wallet:');
console.log(`   1. Envía PYUSD tokens a: ${wallet.address}`);
console.log(`   2. Envía USDT tokens a: ${wallet.address}`);
console.log(`   3. Envía ETH para gas (min 0.1 ETH) a: ${wallet.address}`);
console.log('');
console.log('✅ Una vez fondeada, podrás procesar retiros desde la API');
console.log('');

