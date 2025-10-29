#!/usr/bin/env node
/**
 * Register User Script
 * Creates a user and derives Arbitrum and Bitcoin addresses
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/userModel');
const { deriveArbitrumAddress, deriveBitcoinAddress } = require('../services/nearService');

async function registerUser(phoneNumber, name, email) {
  try {
    console.log('📝 Registering new user...\n');
    
    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if user already exists
    const existing = await User.findOne({ phoneNumber });
    if (existing) {
      console.log(`⚠️  User with phone ${phoneNumber} already exists`);
      console.log(`   Name: ${existing.name}`);
      console.log(`   Arbitrum: ${existing.arbitrumAddress || 'Not set'}`);
      console.log(`   Bitcoin: ${existing.bitcoinAddress || 'Not set'}`);
      
      // If addresses are missing, derive them
      let updated = false;
      
      if (!existing.arbitrumAddress) {
        console.log('\n📍 Deriving Arbitrum address...');
        const sanitized = phoneNumber.replace(/[^0-9]/g, '');
        const arbPath = `arb-${sanitized}`;
        existing.arbitrumAddress = await deriveArbitrumAddress(arbPath);
        console.log(`✅ Arbitrum address: ${existing.arbitrumAddress}`);
        updated = true;
      }
      
      if (!existing.bitcoinAddress) {
        console.log('\n📍 Deriving Bitcoin address...');
        const sanitized = phoneNumber.replace(/[^0-9]/g, '');
        const btcPath = `btc-${sanitized}`;
        existing.bitcoinAddress = await deriveBitcoinAddress(btcPath);
        console.log(`✅ Bitcoin address: ${existing.bitcoinAddress}`);
        updated = true;
      }
      
      if (updated) {
        await existing.save();
        console.log('\n✅ User updated with new addresses');
      }
      
      await mongoose.disconnect();
      return existing;
    }

    // Create new user
    console.log('\n📝 Creating user in database...');
    const user = await User.create({
      phoneNumber,
      name,
      email
    });
    console.log(`✅ User created: ${user.name} (${user._id})`);

    // Derive Arbitrum address
    console.log('\n📍 Deriving Arbitrum address...');
    const sanitizedPhone = phoneNumber.replace(/[^0-9]/g, '');
    const arbPath = `arb-${sanitizedPhone}`;
    console.log(`   Derivation path: ${arbPath}`);
    
    const arbitrumAddress = await deriveArbitrumAddress(arbPath);
    user.arbitrumAddress = arbitrumAddress;
    console.log(`✅ Arbitrum address: ${arbitrumAddress}`);

    // Derive Bitcoin address
    console.log('\n📍 Deriving Bitcoin address...');
    const btcPath = `btc-${sanitizedPhone}`;
    console.log(`   Derivation path: ${btcPath}`);
    
    const bitcoinAddress = await deriveBitcoinAddress(btcPath);
    user.bitcoinAddress = bitcoinAddress;
    console.log(`✅ Bitcoin address: ${bitcoinAddress}`);

    // Save addresses
    await user.save();
    
    console.log('\n✅ User registration complete!');
    console.log('\n📊 Summary:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Phone: ${user.phoneNumber}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Arbitrum: ${user.arbitrumAddress}`);
    console.log(`   Bitcoin: ${user.bitcoinAddress}`);
    console.log(`   PYUSD Balance: ${user.balances.find(b => b.currency === 'PYUSD-ARB')?.amount || 0}`);

    await mongoose.disconnect();
    return user;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const phoneNumber = process.argv[2];
const name = process.argv[3];
const email = process.argv[4];

if (!phoneNumber || !name || !email) {
  console.error('Usage: node scripts/registerUser.js <PHONE> <NAME> <EMAIL>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/registerUser.js "+523111392820" "Test User" "test@example.com"');
  process.exit(1);
}

registerUser(phoneNumber, name, email);

