const { setupAdapter } = require('near-ca');
const bitcoin = require('bitcoinjs-lib');
const { JsonRpcProvider } = require('near-api-js/lib/providers');
const baseX = require('base-x').default;

// Base58 alphabet used by Bitcoin/NEAR
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = baseX(BASE58_ALPHABET);

/**
 * Derives an Arbitrum (EVM) address from a given derivation path using the NEAR MPC.
 * @param {string} derivationPath - The unique path to derive the key from (e.g., 'arb-525522339971').
 * @returns {Promise<string>} The derived Arbitrum address.
 */
const deriveArbitrumAddress = async (derivationPath) => {
  try {
    const accountId = process.env.NEAR_ACCOUNT_ID;
    const privateKey = process.env.NEAR_PRIVATE_KEY;
    const mpcContractId = process.env.NEAR_MPC_CONTRACT_ID || 'v1.signer-prod.testnet';

    if (!accountId) {
      throw new Error('NEAR_ACCOUNT_ID is required in .env file');
    }

    // Setup the EVM adapter using near-ca
    const adapter = await setupAdapter({
      accountId,
      mpcContractId,
      derivationPath,
      privateKey,
    });

    // The address is a property, not a method
    const arbitrumAddress = adapter.address;

    return arbitrumAddress;

  } catch (error) {
    console.error('Error in deriveArbitrumAddress:', error);
    throw new Error(`Could not derive Arbitrum address via NEAR MPC. Original error: ${error.message}`);
  }
};

/**
 * Gets the public key from the near-ca adapter for a given derivation path
 * @param {string} derivationPath - The derivation path
 * @returns {Promise<Buffer>} The uncompressed public key as a Buffer
 */
const getPublicKeyFromAdapter = async (derivationPath) => {
  const accountId = process.env.NEAR_ACCOUNT_ID;
  const privateKey = process.env.NEAR_PRIVATE_KEY;
  const mpcContractId = process.env.NEAR_MPC_CONTRACT_ID || 'v1.signer-prod.testnet';

  if (!accountId) {
    throw new Error('NEAR_ACCOUNT_ID is required in .env file');
  }

  console.log(`Deriving key for path: ${derivationPath}`);

  // Setup the adapter using near-ca
  const adapter = await setupAdapter({
    accountId,
    mpcContractId,
    derivationPath,
    privateKey,
  });

  // Get the EVM address (which is derived from the public key)
  const evmAddress = adapter.address;
  console.log(`EVM address for ${derivationPath}: ${evmAddress}`);

  // The EVM address is the last 20 bytes of keccak256(publicKey)
  // We need to reverse engineer the public key from near-ca's internal state
  // However, near-ca doesn't expose the raw public key directly
  // We'll use ethers to extract it from the address indirectly via signing
  
  // Actually, we can compute the public key from the derivation ourselves
  // Let's use a different approach: get the public key from the MPC contract with the account_id prefix
  const { ethers } = require('ethers');
  
  // Use the NearEthAdapter to get  the derived public key
  // The adapter internally has the derived public key used to compute the address
  // For Bitcoin, we need the same secp256k1 public key that was used for the EVM address
  
  // Convert EVM address back to public key is not possible directly
  // We need to call the MPC contract with the correct parameters
  const provider = new JsonRpcProvider({ url: `https://rpc.testnet.near.org` });
  
  const response = await provider.query({
    request_type: 'call_function',
    account_id: mpcContractId,
    method_name: 'derived_public_key',
    args_base64: Buffer.from(JSON.stringify({ 
      path: derivationPath,
      predecessor: accountId 
    })).toString('base64'),
    finality: 'final',
  });

  const publicKeyString = JSON.parse(Buffer.from(response.result).toString());
  console.log(`Received derived public key for ${derivationPath}: ${publicKeyString}`);
  
  // The public key comes in format "secp256k1:base58encodedkey"
  // Extract the base58 part and decode it
  const parts = publicKeyString.split(':');
  if (parts.length !== 2 || parts[0] !== 'secp256k1') {
    throw new Error(`Unexpected public key format: ${publicKeyString}`);
  }
  
  // Decode base58 to get the raw public key bytes
  const publicKeyBytes = bs58.decode(parts[1]);
  
  // The decoded bytes should be 64 bytes (x + y coordinates)
  // We need to add the 0x04 prefix for uncompressed format
  return Buffer.concat([Buffer.from([0x04]), publicKeyBytes]);
};

/**
 * Derives a Bitcoin address (Bech32 format - bc1) from a given derivation path using the NEAR MPC.
 * @param {string} derivationPath - The unique path to derive the key from (e.g., 'btc-525522339971').
 * @returns {Promise<string>} The derived Bitcoin address in Bech32 format.
 */
const deriveBitcoinAddress = async (derivationPath) => {
  try {
    // Get the raw uncompressed public key from MPC using the derived_public_key method
    const uncompressedPubKey = await getPublicKeyFromAdapter(derivationPath);

    // Verify it's 65 bytes (04 + 32 bytes x + 32 bytes y)
    if (uncompressedPubKey.length !== 65) {
      throw new Error(`Invalid public key length: ${uncompressedPubKey.length}. Expected 65 bytes.`);
    }

    // Extract coordinates
    const xCoord = uncompressedPubKey.slice(1, 33);
    const yCoord = uncompressedPubKey.slice(33, 65);
    
    // Compress the public key: 0x02 or 0x03 prefix + x coordinate
    const isYEven = yCoord[yCoord.length - 1] % 2 === 0;
    const compressedPubKey = Buffer.concat([
      Buffer.from([isYEven ? 0x02 : 0x03]),
      xCoord
    ]);

    // Create a P2WPKH (Native SegWit) address - bc1 format
    const network = bitcoin.networks.bitcoin; // For mainnet
    // Use bitcoin.networks.testnet for testnet addresses (tb1...)
    
    const payment = bitcoin.payments.p2wpkh({
      pubkey: compressedPubKey,
      network: network,
    });

    if (!payment.address) {
      throw new Error('Failed to generate Bitcoin address from public key');
    }

    return payment.address;

  } catch (error) {
    console.error('Error in deriveBitcoinAddress:', error);
    throw new Error(`Could not derive Bitcoin address via NEAR MPC. Original error: ${error.message}`);
  }
};

/**
 * Signs an EVM transaction using NEAR MPC
 * @param {string} derivationPath - The derivation path for the user's wallet
 * @param {Object} transaction - The transaction object to sign
 * @returns {Promise<string>} The signed transaction hex string
 */
const signEvmTransactionWithMPC = async (derivationPath, transaction) => {
  try {
    const accountId = process.env.NEAR_ACCOUNT_ID;
    const privateKey = process.env.NEAR_PRIVATE_KEY;
    const mpcContractId = process.env.NEAR_MPC_CONTRACT_ID || 'v1.signer-prod.testnet';

    if (!accountId) {
      throw new Error('NEAR_ACCOUNT_ID is required in .env file');
    }

    console.log(`🔐 Signing transaction with MPC for path: ${derivationPath}`);

    // Setup the EVM adapter using near-ca
    const adapter = await setupAdapter({
      accountId,
      mpcContractId,
      derivationPath,
      privateKey,
    });

    // Sign the transaction using the adapter
    const signedTx = await adapter.signAndSendTransaction(transaction);

    console.log(`✅ Transaction signed successfully: ${signedTx.hash}`);

    return signedTx;

  } catch (error) {
    console.error('Error signing transaction with MPC:', error);
    throw new Error(`Could not sign transaction via NEAR MPC. Original error: ${error.message}`);
  }
};

/**
 * Gets an adapter instance for a specific derivation path
 * Useful for multiple operations on the same address
 * @param {string} derivationPath - The derivation path
 * @returns {Promise<Object>} The near-ca adapter instance
 */
const getAdapter = async (derivationPath) => {
  const accountId = process.env.NEAR_ACCOUNT_ID;
  const privateKey = process.env.NEAR_PRIVATE_KEY;
  const mpcContractId = process.env.NEAR_MPC_CONTRACT_ID || 'v1.signer-prod.testnet';

  if (!accountId) {
    throw new Error('NEAR_ACCOUNT_ID is required in .env file');
  }

  return await setupAdapter({
    accountId,
    mpcContractId,
    derivationPath,
    privateKey,
  });
};

module.exports = {
  deriveArbitrumAddress,
  deriveBitcoinAddress,
  signEvmTransactionWithMPC,
  getAdapter,
};
