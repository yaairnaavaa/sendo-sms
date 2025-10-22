# API SENDO

API REST para la gestión de usuarios, balances de criptomonedas y generación de wallets multi-cadena utilizando NEAR Protocol Chain Signatures (MPC).

## 📋 Descripción del Proyecto

SENDO es una API que permite:
- Gestionar usuarios con información básica (nombre, teléfono, email)
- Administrar balances en múltiples criptomonedas (PYUSD-ARB, USDT-ARB, SAT-BTC)
- Generar direcciones de wallet únicas para cada usuario en diferentes blockchains
- Registrar y consultar historial de transacciones

## 🔑 Características Principales

### Gestión de Usuarios
- CRUD completo de usuarios
- Validación de datos (teléfono, email)
- Balances integrados por usuario

### Balances Multi-Moneda
- PYUSD-ARB (PayPal USD en Arbitrum)
- USDT-ARB (Tether en Arbitrum)
- SAT-BTC (Satoshis en Bitcoin)

### Transacciones
- Depósitos con direcciones únicas por usuario
- Monitoreo automático de blockchain para detectar depósitos
- Retiros
- Transferencias entre usuarios
- Historial completo de transacciones con metadata blockchain

### Generación de Wallets Multi-Cadena
La característica más innovadora del proyecto es la **generación determinística de wallets** para diferentes blockchains utilizando **NEAR Protocol Chain Signatures (MPC)**.

## 🌐 Arquitectura de Wallets

### ¿Cómo Funciona?

El sistema utiliza **NEAR Protocol Multi-Party Computation (MPC)** para generar wallets de forma segura y determinística:

```
┌─────────────────────────────────────────────────────────────┐
│                     NEAR Account (MPC)                       │
│                  (Una única cuenta maestra)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Derivación por número de teléfono
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │  User 1 │       │  User 2 │       │  User 3 │
   └─────────┘       └─────────┘       └─────────┘
        │                  │                  │
   arb-1123...        arb-4412...        arb-1650...
   btc-1123...        btc-4412...        btc-1650...
        │                  │                  │
        ▼                  ▼                  ▼
   0x379...           0xd97...           0xb12...
   bc1qlvz...         bc1q3p9...         bc1qst4...
```

### Ventajas de Esta Arquitectura

1. **Una Sola Cuenta NEAR**: Solo necesitas administrar una cuenta NEAR
2. **Múltiples Wallets**: Genera infinitas direcciones para diferentes usuarios y blockchains
3. **Determinístico**: Las mismas credenciales siempre generan las mismas direcciones
4. **Seguro**: Usa MPC, no hay una sola clave privada vulnerable
5. **Multi-Chain**: Soporta cualquier blockchain (EVM, Bitcoin, etc.)

### Proceso de Generación de Wallets

#### 1. Generación de Direcciones Arbitrum (EVM)

```javascript
// Ruta de derivación basada en el número de teléfono
const derivationPath = `arb-${phoneNumber}`; // ej: "arb-11234567890"

// El MPC de NEAR deriva una clave pública única
const adapter = await setupAdapter({
  accountId: 'tu-cuenta.testnet',
  mpcContractId: 'v1.signer-prod.testnet',
  derivationPath: 'arb-11234567890',
  privateKey: 'ed25519:...'
});

// Obtiene la dirección EVM
const arbitrumAddress = adapter.address; // 0x3796f33ad8104579a37577fd9ae7e64551bd6f2d
```

**Resultado**: Dirección Ethereum/Arbitrum (formato `0x...`)

#### 2. Generación de Direcciones Bitcoin (Bech32)

```javascript
// Ruta de derivación basada en el número de teléfono
const derivationPath = `btc-${phoneNumber}`; // ej: "btc-11234567890"

// 1. Obtener la clave pública derivada del MPC
const response = await provider.query({
  request_type: 'call_function',
  account_id: 'v1.signer-prod.testnet',
  method_name: 'derived_public_key',
  args_base64: Buffer.from(JSON.stringify({ 
    path: 'btc-11234567890',
    predecessor: 'tu-cuenta.testnet'
  })).toString('base64')
});

// 2. Decodificar la clave pública (formato base58 → Buffer)
const publicKeyBytes = bs58.decode(publicKeyString.split(':')[1]);

// 3. Comprimir la clave pública (necesario para Bitcoin)
const compressedPubKey = compressPublicKey(publicKeyBytes);

// 4. Generar dirección P2WPKH (Bech32)
const { address } = bitcoin.payments.p2wpkh({
  pubkey: compressedPubKey,
  network: bitcoin.networks.bitcoin
});
```

**Resultado**: Dirección Bitcoin Bech32 (formato `bc1...`)

### Formatos de Dirección

| Blockchain | Formato | Ejemplo | Descripción |
|------------|---------|---------|-------------|
| Arbitrum   | `0x...` | `0x3796f33ad8104579a37577fd9ae7e64551bd6f2d` | Dirección EVM estándar (20 bytes hex) |
| Bitcoin    | `bc1...` | `bc1qlvznt4lgsdjzgddyrqlvurrfdxut376ylfkzlc` | Bech32 P2WPKH (Native SegWit) |

### Rutas de Derivación

Las rutas de derivación se construyen usando el número de teléfono del usuario (sin caracteres especiales):

```
Formato: [blockchain]-[phoneNumber]

Ejemplos:
- Usuario con teléfono +1 (123) 456-7890
  → Arbitrum: "arb-11234567890"
  → Bitcoin: "btc-11234567890"

- Usuario con teléfono +52 55 2233 9971
  → Arbitrum: "arb-525522339971"
  → Bitcoin: "btc-525522339971"
```

## 🚀 Instalación

### Requisitos Previos

- Node.js v18 o superior
- MongoDB instalado y corriendo
- Cuenta de NEAR Protocol (testnet o mainnet)

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd api-sendo
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crear un archivo `.env` en la raíz del proyecto:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/sendo

# Server
PORT=3000
NODE_ENV=development

# NEAR Protocol Configuration
NEAR_ACCOUNT_ID=tu-cuenta.testnet
NEAR_PRIVATE_KEY=ed25519:TU_CLAVE_PRIVADA_AQUI
NEAR_MPC_CONTRACT_ID=v1.signer-prod.testnet
NEAR_NETWORK_ID=testnet
```

4. **Iniciar el servidor**
```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 📚 API Endpoints

### Usuarios

#### Obtener todos los usuarios
```http
GET /api/users
```

#### Obtener un usuario
```http
GET /api/users/:id
```

#### Crear un usuario
```http
POST /api/users
Content-Type: application/json

{
  "phoneNumber": "+11234567890",
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Actualizar un usuario
```http
PUT /api/users/:id
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john.smith@example.com"
}
```

#### Eliminar un usuario
```http
DELETE /api/users/:id
```

### Balances

#### Obtener balances de un usuario
```http
GET /api/users/:userId/balances
```

#### Actualizar balance de un usuario
```http
PUT /api/users/:userId/balances
Content-Type: application/json

{
  "currency": "PYUSD-ARB",
  "amount": 100
}
```

### Transacciones

#### Obtener transacciones de un usuario
```http
GET /api/users/:userId/transactions
```

#### Crear una transacción
```http
POST /api/users/:userId/transactions
Content-Type: application/json

{
  "type": "deposit",
  "currency": "USDT-ARB",
  "amount": 50
}
```

### Depósitos

#### Obtener información de depósito
```http
GET /api/users/:userId/deposit
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "phoneNumber": "+11234567890"
    },
    "deposits": [
      {
        "asset": "BTC",
        "network": "Bitcoin Mainnet",
        "address": "bc1qlvznt4lgsdjzgddyrqlvurrfdxut376ylfkzlc",
        "minimumDeposit": "0.00001 BTC",
        "confirmations": 3,
        "instructions": "Send Bitcoin to this address. Funds will be credited after 3 confirmations.",
        "qrCode": "bitcoin:bc1qlvznt4lgsdjzgddyrqlvurrfdxut376ylfkzlc"
      },
      {
        "asset": "PYUSD",
        "network": "Arbitrum One",
        "contractAddress": "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
        "address": "0x3796f33ad8104579a37577fd9ae7e64551bd6f2d",
        "minimumDeposit": "1 PYUSD",
        "confirmations": 12,
        "instructions": "Send PYUSD tokens to this Arbitrum address...",
        "warning": "⚠️ Only send PYUSD tokens on Arbitrum One..."
      },
      {
        "asset": "USDT",
        "network": "Arbitrum One",
        "contractAddress": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        "address": "0x3796f33ad8104579a37577fd9ae7e64551bd6f2d",
        "minimumDeposit": "1 USDT",
        "confirmations": 12,
        "instructions": "Send USDT tokens to this Arbitrum address..."
      }
    ],
    "currentBalances": [
      { "currency": "PYUSD-ARB", "amount": 0 },
      { "currency": "USDT-ARB", "amount": 0 },
      { "currency": "SAT-BTC", "amount": 0 }
    ]
  }
}
```

#### Procesar un depósito manualmente (webhook)
```http
POST /api/users/:userId/deposit/process
Content-Type: application/json

{
  "asset": "PYUSD",
  "amount": 100,
  "txHash": "0xabcd1234...",
  "confirmations": 15,
  "fromAddress": "0x..."
}
```

### Retiros (Withdrawals)

#### Obtener información sobre retiros
```http
GET /api/withdrawals/info
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "supportedCurrencies": ["PYUSD-ARB", "USDT-ARB"],
    "minimumAmounts": {
      "PYUSD-ARB": 1,
      "USDT-ARB": 1
    },
    "maximumAmounts": {
      "PYUSD-ARB": 10000,
      "USDT-ARB": 10000
    },
    "fees": {
      "PYUSD-ARB": 0.5,
      "USDT-ARB": 0.5
    },
    "requiredConfirmations": 2,
    "note": "Fees are deducted from your balance in addition to the withdrawal amount"
  }
}
```

#### Validar un retiro (dry run)
```http
POST /api/withdrawals/validate
Content-Type: application/json

{
  "userId": "673662e00b83cfa51e6821f5",
  "currency": "PYUSD-ARB",
  "amount": 10,
  "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "valid": true,
  "message": "Withdrawal is valid",
  "data": {
    "amount": 10,
    "currency": "PYUSD-ARB",
    "fee": 0.5,
    "totalRequired": 10.5,
    "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }
}
```

**Respuesta con errores:**
```json
{
  "success": false,
  "valid": false,
  "message": "Withdrawal validation failed",
  "errors": [
    "Insufficient balance. Required: 10.5 PYUSD-ARB (10 + 0.5 fee), Available: 5 PYUSD-ARB"
  ]
}
```

#### Estimar costo de un retiro
```http
POST /api/withdrawals/estimate-cost
Content-Type: application/json

{
  "currency": "PYUSD-ARB",
  "amount": 10,
  "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "gasEstimate": "65000",
    "gasPrice": "0.1",
    "gasCostETH": 0.0000065,
    "fee": 0.5
  }
}
```

#### Crear un retiro
```http
POST /api/withdrawals
Content-Type: application/json

{
  "userId": "673662e00b83cfa51e6821f5",
  "currency": "PYUSD-ARB",
  "amount": 10,
  "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Withdrawal completed successfully",
  "data": {
    "transactionId": "673662f90b83cfa51e6821f8",
    "txHash": "0xabc123...",
    "amount": 10,
    "currency": "PYUSD-ARB",
    "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "fee": 0.5,
    "totalDeducted": 10.5,
    "status": "completed"
  }
}
```

#### Obtener retiros de un usuario
```http
GET /api/withdrawals/user/:userId
```

**Respuesta:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "673662f90b83cfa51e6821f8",
      "user": "673662e00b83cfa51e6821f5",
      "type": "withdrawal",
      "currency": "PYUSD-ARB",
      "amount": 10,
      "status": "completed",
      "metadata": {
        "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "fee": 0.5,
        "totalDeducted": 10.5,
        "txHash": "0xabc123...",
        "hotWalletAddress": "0x...",
        "initiatedAt": "2024-11-14T10:00:00.000Z",
        "sentAt": "2024-11-14T10:00:05.000Z",
        "confirmedAt": "2024-11-14T10:00:30.000Z",
        "blockNumber": 12345678,
        "gasUsed": "65000"
      },
      "createdAt": "2024-11-14T10:00:00.000Z"
    }
  ]
}
```

#### Obtener información de un retiro específico
```http
GET /api/withdrawals/:transactionId
```

#### Obtener balances de la hot wallet (solo admin)
```http
GET /api/withdrawals/hot-wallet/balances
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "balances": {
      "PYUSD": 50000,
      "USDT": 75000,
      "ETH": 2.5
    }
  }
}
```

### Wallets

#### Generar dirección de Arbitrum
```http
POST /api/users/:userId/arbitrum-account
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "John Doe",
    "phoneNumber": "+11234567890",
    "arbitrumAddress": "0x3796f33ad8104579a37577fd9ae7e64551bd6f2d",
    ...
  }
}
```

#### Generar dirección de Bitcoin
```http
POST /api/users/:userId/bitcoin-account
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "John Doe",
    "phoneNumber": "+11234567890",
    "bitcoinAddress": "bc1qlvznt4lgsdjzgddyrqlvurrfdxut376ylfkzlc",
    ...
  }
}
```

### Servicios de Monitoreo

#### Ver estado del monitoreo
```http
GET /api/monitor/status
```

#### Iniciar servicios de monitoreo
```http
POST /api/monitor/start
```

#### Detener servicios de monitoreo
```http
POST /api/monitor/stop
```

#### Sincronizar balances manualmente
```http
POST /api/monitor/sync
```

#### Ejecutar sweep manual
```http
POST /api/monitor/sweep
```

## 🔄 Sistema de Depósitos y Monitoreo

### Flujo de Depósito

```
1. Usuario solicita información de depósito
   ↓
2. API devuelve dirección única del usuario
   ↓
3. Usuario envía criptomonedas a la dirección
   ↓
4. Servicio de monitoreo detecta la transacción
   ↓
5. Sistema espera confirmaciones necesarias
   ↓
6. Balance se actualiza automáticamente
   ↓
7. (Opcional) Sweep automático a cuenta maestra
```

### Componentes del Sistema

#### 1. **Servicio de Monitoreo de Arbitrum**
- Escucha eventos `Transfer` de contratos PYUSD y USDT
- Detecta depósitos en tiempo real
- Verifica confirmaciones antes de acreditar
- Actualiza balances automáticamente

#### 2. **Servicio de Monitoreo de Bitcoin**
- Consulta API de Blockstream cada 60 segundos
- Verifica transacciones en direcciones de usuarios
- Requiere 3 confirmaciones antes de acreditar
- Procesa satoshis directamente

#### 3. **Servicio de Sweep**
- Concentra fondos en cuenta maestra
- Se ejecuta automáticamente cada hora
- Umbrales configurables por moneda:
  - PYUSD: 10+
  - USDT: 10+
  - BTC: 100,000 satoshis (0.001 BTC)
- Usa NEAR MPC para firmar transacciones

### Configuración del Monitoreo

Agregar al archivo `.env`:

```env
# Blockchain RPCs
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BITCOIN_RPC_URL=https://blockstream.info/api

# Master wallet for sweep
MASTER_WALLET_ADDRESS=0x...
```

### Iniciar Monitoreo Automáticamente

El monitoreo NO se inicia automáticamente al levantar el servidor. Debes iniciarlo manualmente:

```bash
# Iniciar monitoreo
curl -X POST http://localhost:3000/api/monitor/start

# Verificar estado
curl http://localhost:3000/api/monitor/status

# Detener monitoreo
curl -X POST http://localhost:3000/api/monitor/stop
```

## 🧹 SWEEP SERVICE - Consolidación de Fondos

### ⭐ NUEVA FUNCIONALIDAD IMPLEMENTADA

El sistema ahora cuenta con un **Sweep Service completamente funcional** que consolida fondos de direcciones de depósito de usuarios hacia la cuenta treasury usando:

- ✅ **NEAR MPC** para firmar transacciones desde wallets derivadas
- ✅ **Gas Sponsor Wallet** para pagar gas fees
- ✅ **Smart Sweep** basado en liquidez de treasury
- ✅ **Threshold Sweep** basado en balances de usuarios
- ✅ **Automatic & Manual** modes

### Arquitectura de Tres Niveles

```
┌─────────────────────────────────────────────────────────────┐
│                   WALLET ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. USER DEPOSIT ADDRESSES (MPC-Derived)                    │
│     - Generadas con NEAR MPC                                │
│     - Reciben depósitos de usuarios                         │
│     - NO almacenan ETH (gas lo provee Gas Sponsor)          │
│                    ↓                                         │
│  2. GAS SPONSOR WALLET (Hot, ETH only)                      │
│     - Envía ETH a deposit addresses para gas                │
│     - Solo mantiene ETH (~1-2 ETH)                          │
│     - Paga gas fees de todas las operaciones sweep          │
│                    ↓                                         │
│  3. TREASURY WALLET (Cold Storage)                          │
│     - Recibe todos los tokens consolidados                  │
│     - Cold wallet / Multi-sig recomendado                   │
│     - Almacena la mayoría de los fondos                     │
│                    ↓                                         │
│  4. HOT WALLET (For Withdrawals)                            │
│     - Procesa retiros de usuarios                           │
│     - Limitada liquidez para operaciones diarias            │
│     - Se fondea desde Treasury cuando es necesario          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Sweep

```
1. Usuario deposita → Deposit Address (user1.arbitrumAddress)
2. Monitor detecta depósito → Actualiza DB
3. Sweep Service verifica si es necesario barrer:
   ┌─────────────────────────────────────────────────┐
   │ SMART MODE (Recomendado):                       │
   │ - Verifica liquidez en Treasury                 │
   │ - Solo barre si Treasury < MIN_RESERVE          │
   │ - Threshold dinámico (más agresivo si urgente)  │
   └─────────────────────────────────────────────────┘
   ┌─────────────────────────────────────────────────┐
   │ THRESHOLD MODE:                                 │
   │ - Barre si balance usuario > THRESHOLD          │
   │ - Ejecuta en intervalos regulares               │
   └─────────────────────────────────────────────────┘
4. Gas Sponsor envía ETH a Deposit Address para gas
5. MPC firma transacción desde Deposit Address
6. Tokens se transfieren a Treasury
7. DB se actualiza (balance usuario = 0)
```

### Modos de Sweep

#### 1. **Smart Sweep** (⭐ RECOMENDADO)
```bash
# Barre solo cuando Treasury necesita liquidez
curl -X POST http://localhost:3000/api/monitor/sweep/smart
```

**Características:**
- Verifica balance de Treasury
- Solo barre si Treasury < `MIN_TREASURY_RESERVE`
- Threshold dinámico (50% del normal si es urgente)
- Minimiza gas fees al barrer solo cuando es necesario
- Ideal para producción

**Configuración:**
```env
SWEEP_MODE=smart
MIN_TREASURY_RESERVE_PYUSD=10000
MIN_TREASURY_RESERVE_USDT=10000
```

#### 2. **Threshold Sweep**
```bash
# Barre todos los usuarios con balance > THRESHOLD
curl -X POST http://localhost:3000/api/monitor/sweep
```

**Características:**
- Barre cuando balance usuario > threshold configurado
- Ejecución regular en intervalos
- Más predecible pero puede incurrir más gas fees

**Configuración:**
```env
SWEEP_MODE=threshold
SWEEP_THRESHOLD_PYUSD=100
SWEEP_THRESHOLD_USDT=100
```

#### 3. **Manual Mode**
```bash
# Deshabilita sweep automático
SWEEP_MODE=disabled
```

### Endpoints de Sweep

#### Ver estadísticas de sweep
```http
GET /api/monitor/sweep/stats
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "sweepableBalances": {
      "PYUSD-ARB": { "count": 5, "totalAmount": 1250.5 },
      "USDT-ARB": { "count": 3, "totalAmount": 890.25 }
    },
    "gasSponsorBalance": {
      "address": "0x123...",
      "eth": 1.5
    },
    "treasuryBalances": {
      "address": "0x456...",
      "PYUSD": 15000,
      "USDT": 12000
    }
  }
}
```

#### Verificar si Treasury necesita liquidez
```http
GET /api/monitor/sweep/liquidity-check
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "shouldSweep": true,
    "currencies": ["PYUSD-ARB"],
    "details": [
      {
        "currency": "PYUSD-ARB",
        "currentBalance": 8000,
        "targetBalance": 10000,
        "deficit": 2000
      }
    ]
  }
}
```

#### Ejecutar sweep inteligente
```http
POST /api/monitor/sweep/smart
```

#### Ejecutar sweep por threshold
```http
POST /api/monitor/sweep
```

### Configuración de Variables de Entorno

Ver el archivo `ENV_CONFIGURATION.md` para documentación completa.

**Variables Críticas:**
```env
# Gas Sponsor (REQUERIDO para sweep)
GAS_SPONSOR_PRIVATE_KEY=your_private_key_here

# Treasury (REQUERIDO para sweep)
TREASURY_WALLET_ADDRESS=0xYourTreasuryAddress

# Sweep Configuration
SWEEP_MODE=smart
SWEEP_INTERVAL_HOURS=6
SWEEP_THRESHOLD_PYUSD=100
SWEEP_THRESHOLD_USDT=100
MIN_TREASURY_RESERVE_PYUSD=10000
MIN_TREASURY_RESERVE_USDT=10000
```

### Costos de Gas

En Arbitrum One:
- **Gas por sweep**: ~65,000 gas
- **Costo aproximado**: $0.01 - $0.05 USD
- **Con threshold de $100**: Fee ratio ~0.01-0.05%

**Ejemplo con 100 usuarios depositando $50 cada uno:**
- Total depositado: $5,000
- Sweeps necesarios: ~50 (con threshold $100)
- Costo total gas: ~$0.50 - $2.50
- **Fee ratio: 0.01-0.05%** ✅

### Seguridad y Best Practices

1. **✅ Separación de Wallets**
   - Gas Sponsor: Solo ETH
   - Deposit Addresses: Tokens recibidos
   - Treasury: Cold storage
   - Hot Wallet: Retiros

2. **✅ Monitoreo de Balances**
   ```bash
   # Verificar estado regularmente
   curl http://localhost:3000/api/monitor/sweep/stats
   ```

3. **✅ Fondeo de Gas Sponsor**
   - Mantener 1-2 ETH en Arbitrum
   - Monitorear y recargar cuando < 0.5 ETH

4. **✅ Configuración de Treasury**
   - Usar hardware wallet o multi-sig
   - Nunca usar la misma wallet para withdrawals

5. **✅ Thresholds Apropiados**
   - Ajustar según volumen de transacciones
   - Balance entre seguridad y eficiencia

### Esquemas Recomendados

#### Opción 1: Smart Sweep (⭐ RECOMENDADO para Producción)
- **Modo**: `SWEEP_MODE=smart`
- **Frecuencia**: Cada 6 horas
- **Lógica**: Solo barre cuando Treasury necesita fondos

**Pros:**
- ✅ Minimiza costos de gas
- ✅ Mantiene liquidez óptima en Treasury
- ✅ Se adapta automáticamente a demanda
- ✅ Menos transacciones on-chain

**Contras:**
- ⚠️ Fondos permanecen más tiempo en deposit addresses
- ⚠️ Requiere configuración de reserves apropiada

**Ideal para:**
- Producción con volumen alto-medio
- Cuando optimización de gas es prioridad
- Operaciones con liquidez predecible

#### Opción 2: Threshold Sweep (Bueno para MVP)
- **Modo**: `SWEEP_MODE=threshold`
- **Frecuencia**: Cada 1-3 horas
- **Lógica**: Barre todos los usuarios con balance > threshold

**Pros:**
- ✅ Simple y predecible
- ✅ Fondos se consolidan regularmente
- ✅ Fácil de entender y monitorear

**Contras:**
- ⚠️ Más transacciones de gas
- ⚠️ Puede barrer innecesariamente

**Ideal para:**
- MVP y testing
- Volúmenes bajos
- Cuando seguridad > eficiencia

#### Opción 3: Manual Sweep (Para Desarrollo)
- **Modo**: `SWEEP_MODE=disabled`
- **Ejecución**: Manual via API

**Pros:**
- ✅ Control total
- ✅ Sin sorpresas
- ✅ Ideal para testing

**Contras:**
- ⚠️ Requiere intervención manual
- ⚠️ No escalable

**Ideal para:**
- Desarrollo y staging
- Testing de integración
- Debugging

### Ejemplo de Flujo Completo

```bash
# 1. Configurar variables de entorno
cat > .env << EOF
GAS_SPONSOR_PRIVATE_KEY=0x...
TREASURY_WALLET_ADDRESS=0x...
SWEEP_MODE=smart
SWEEP_INTERVAL_HOURS=6
MIN_TREASURY_RESERVE_PYUSD=10000
EOF

# 2. Iniciar servidor
npm start

# 3. Iniciar monitoreo (incluye sweep automático)
curl -X POST http://localhost:3000/api/monitor/start

# 4. Verificar configuración
curl http://localhost:3000/api/monitor/sweep/stats | jq

# 5. Usuario deposita fondos
# ... (el monitor detecta automáticamente)

# 6. Verificar si necesita sweep
curl http://localhost:3000/api/monitor/sweep/liquidity-check | jq

# 7. (Opcional) Ejecutar sweep manual si es necesario
curl -X POST http://localhost:3000/api/monitor/sweep/smart | jq

# 8. Verificar resultado
curl http://localhost:3000/api/monitor/sweep/stats | jq
```

### Monitoreo y Alertas

**Métricas clave a monitorear:**

1. **Gas Sponsor Balance**
   ```bash
   # Alerta si < 0.5 ETH
   curl http://localhost:3000/api/monitor/sweep/stats | jq '.data.gasSponsorBalance.eth'
   ```

2. **Treasury Balances**
   ```bash
   # Verificar niveles de liquidez
   curl http://localhost:3000/api/monitor/sweep/stats | jq '.data.treasuryBalances'
   ```

3. **Sweepable Balances**
   ```bash
   # Ver cuántos fondos están pendientes de barrer
   curl http://localhost:3000/api/monitor/sweep/stats | jq '.data.sweepableBalances'
   ```

4. **Sweep Success Rate**
   ```bash
   # Monitorear transacciones de sweep en DB
   # Buscar status: 'failed' en metadata.sweepToTreasury: true
   ```

### Troubleshooting

#### Error: "Gas sponsor wallet not configured"
```bash
# Solución: Agregar clave privada al .env
echo "GAS_SPONSOR_PRIVATE_KEY=0xYourPrivateKey" >> .env
```

#### Error: "Insufficient balance in hot wallet"
```bash
# El Gas Sponsor necesita más ETH
# Enviar 1-2 ETH a la dirección del Gas Sponsor en Arbitrum
```

#### Sweep no se ejecuta automáticamente
```bash
# Verificar configuración
curl http://localhost:3000/api/monitor/status

# Verificar logs del servidor para mensajes de sweep
# Asegurarse que SWEEP_MODE != 'disabled'
```

#### Transaction failed on-chain
```bash
# Verificar:
# 1. Gas Sponsor tiene suficiente ETH
# 2. User deposit address tiene tokens
# 3. RPC endpoint está funcionando
# 4. Nonce no está duplicado
```

### Esquemas Recomendados (Resumen Anterior)

#### Opción 1: Monitoreo Activo (Producción)
✅ **Recomendado para producción**
- Monitoreo en tiempo real
- Detección automática de depósitos
- No requiere intervención manual
- ⭐ **Sweep automático funcional con MPC**

**Pros:**
- Totalmente automatizado
- Experiencia de usuario fluida
- Seguro (fondos se mueven a treasury via MPC)
- Smart sweep optimiza costos de gas

**Contras:**
- Requiere infraestructura 24/7
- Costos de RPC/API (mínimos en Arbitrum)
- Complejidad de mantenimiento (ahora simplificado con sweep automático)

#### Opción 2: Webhook/Notificación (Desarrollo)
⚡ **Recomendado para desarrollo/MVP**
- Servicios externos notifican depósitos
- Procesamiento manual via API
- Más simple de implementar

**Pros:**
- Más simple de implementar
- Sin infraestructura compleja
- Ideal para MVP

**Contras:**
- Requiere servicios externos (Alchemy, Moralis, etc.)
- Menos control directo
- Posible latencia

#### Opción 3: Híbrido (Recomendado)
🎯 **El mejor balance**
- Monitoreo pasivo para detección
- Webhook para confirmaciones rápidas
- Sweep programado (no en tiempo real)

## 🏗️ Estructura del Proyecto

```
api-sendo/
├── config/
│   └── database.js              # Configuración de MongoDB
├── controllers/
│   ├── userController.js        # Lógica de usuarios
│   ├── balanceController.js     # Lógica de balances
│   ├── transactionController.js # Lógica de transacciones
│   ├── arbitrumController.js    # Lógica de wallets Arbitrum
│   ├── bitcoinController.js     # Lógica de wallets Bitcoin
│   └── depositController.js     # Lógica de depósitos
├── models/
│   ├── userModel.js             # Esquema de usuario
│   └── transactionModel.js      # Esquema de transacción (con metadata)
├── routes/
│   ├── userRoutes.js            # Rutas de usuarios
│   ├── balanceRoutes.js         # Rutas de balances
│   ├── transactionRoutes.js     # Rutas de transacciones
│   ├── arbitrumRoutes.js        # Rutas de Arbitrum
│   ├── bitcoinRoutes.js         # Rutas de Bitcoin
│   ├── depositRoutes.js         # Rutas de depósitos
│   └── monitorRoutes.js         # Rutas de monitoreo
├── services/
│   ├── nearService.js           # Servicio de NEAR MPC
│   └── blockchainMonitor.js     # Servicios de monitoreo blockchain
├── .env                         # Variables de entorno
├── index.js                     # Punto de entrada
├── package.json                 # Dependencias
└── README.md                    # Este archivo
```

## 🔧 Tecnologías Utilizadas

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **MongoDB** - Base de datos NoSQL
- **Mongoose** - ODM para MongoDB
- **NEAR Protocol** - Chain Signatures (MPC)
- **near-ca** - Librería para NEAR Chain Abstraction
- **ethers.js** - Utilidades para Ethereum/Arbitrum
- **bitcoinjs-lib** - Utilidades para Bitcoin
- **base-x** - Decodificación base58
- **dotenv** - Gestión de variables de entorno

## 🔐 Seguridad

### Variables de Entorno Sensibles

**⚠️ NUNCA commitees el archivo `.env` al repositorio**

El archivo `.env` contiene información sensible:
- Claves privadas de NEAR
- **Clave privada de la Hot Wallet de retiros**
- Credenciales de base de datos
- Configuraciones del servidor

#### Configuración de la Hot Wallet para Withdrawals

```env
# Withdrawal Hot Wallet Configuration
# ⚠️ CRITICAL: Esta wallet debe ser DIFERENTE a las wallets de depósito
# Esta wallet necesita tener fondos para cubrir los retiros de usuarios
WITHDRAWAL_HOT_WALLET_PRIVATE_KEY=your_hot_wallet_private_key_here

# Configuración opcional de límites
MAX_WITHDRAWAL_AMOUNT_PYUSD=10000
MAX_WITHDRAWAL_AMOUNT_USDT=10000
MIN_WITHDRAWAL_AMOUNT=1
```

**¿Por qué una wallet separada para retiros?**

1. **Seguridad**: Si la hot wallet se ve comprometida, solo afecta los fondos disponibles para retiros, no los depósitos de usuarios
2. **Control de liquidez**: Puedes controlar exactamente cuántos fondos están disponibles para retiros
3. **Auditoría**: Es más fácil auditar las transacciones de retiro cuando están separadas
4. **Aislamiento de riesgos**: Las wallets de depósito (derivadas con MPC) permanecen seguras

**Configuración de la Hot Wallet:**

```bash
# 1. Crear una nueva wallet de Ethereum (puedes usar Metamask o web3.js)
# 2. Guardar la clave privada en tu .env
WITHDRAWAL_HOT_WALLET_PRIVATE_KEY=0x1234567890abcdef...

# 3. Fondear la hot wallet con PYUSD, USDT y ETH (para gas)
# - Envía PYUSD tokens a la dirección de la hot wallet
# - Envía USDT tokens a la dirección de la hot wallet  
# - Envía ETH para cubrir los costos de gas

# 4. Verificar balances de la hot wallet
curl http://localhost:3000/api/withdrawals/hot-wallet/balances
```

**Monitoreo de la Hot Wallet:**

Es importante monitorear regularmente:
- Balance de tokens (PYUSD, USDT)
- Balance de ETH para gas
- Alertas cuando los balances están bajos

### Mejores Prácticas

1. **Clave Privada NEAR**: Guárdala de forma segura, preferiblemente usando un gestor de secretos
2. **Hot Wallet de Retiros**: 
   - Usa una wallet dedicada exclusivamente para retiros
   - Mantén solo los fondos necesarios para retiros diarios
   - Implementa un proceso de "refill" regular desde cold storage
   - Monitorea activamente los balances
3. **MongoDB**: En producción, usa autenticación y conexiones seguras
4. **HTTPS**: En producción, usa siempre HTTPS
5. **Rate Limiting**: Implementa límites de peticiones para prevenir abusos
6. **Validación**: Todos los endpoints validan los datos de entrada
7. **Separación de fondos**: Nunca uses la misma wallet para depósitos y retiros

## 📖 Documentación Adicional

### NEAR Protocol Chain Signatures

Para entender más sobre cómo funciona NEAR Chain Signatures:

- [Documentación oficial de NEAR Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures/implementation)
- [Tutorial de NEAR: Controlling Accounts](https://docs.near.org/tutorials/controlling-near-accounts/setup)
- [Ejemplo de Near Multichain](https://github.com/near-examples/near-multichain)

### Formato de Direcciones Bitcoin

- [BIP 173 - Bech32](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki)
- [BIP 84 - Derivation for P2WPKH](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)

## 🧪 Pruebas

### Ejemplo de Flujo Completo con Depósitos

```bash
# 1. Crear un usuario
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+11234567890",
    "name": "Alice",
    "email": "alice@example.com"
  }'
# Guardar el USER_ID de la respuesta

# 2. Generar wallet de Arbitrum
curl -X POST http://localhost:3000/api/users/USER_ID/arbitrum-account

# 3. Generar wallet de Bitcoin
curl -X POST http://localhost:3000/api/users/USER_ID/bitcoin-account

# 4. Obtener información de depósito
curl http://localhost:3000/api/users/USER_ID/deposit | jq .
# Te dará las direcciones para depositar BTC, PYUSD y USDT

# 5. Iniciar servicios de monitoreo (opcional, para detección automática)
curl -X POST http://localhost:3000/api/monitor/start

# 6. Usuario envía fondos a la dirección proporcionada
# (en blockchain real)

# 7. Procesar depósito manualmente (si no usas monitoreo automático)
curl -X POST http://localhost:3000/api/users/USER_ID/deposit/process \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "PYUSD",
    "amount": 100,
    "txHash": "0xabcd1234...",
    "confirmations": 15
  }'

# 8. Ver balance actualizado
curl http://localhost:3000/api/users/USER_ID/balances | jq .

# 9. Ver todas las transacciones
curl http://localhost:3000/api/users/USER_ID/transactions | jq .

# 10. Verificar estado del monitoreo
curl http://localhost:3000/api/monitor/status | jq .

# 11. Sincronizar balances on-chain manualmente
curl -X POST http://localhost:3000/api/monitor/sync

# 12. Ejecutar sweep manual (mover fondos a cuenta maestra)
curl -X POST http://localhost:3000/api/monitor/sweep
```

### Flujo de Depósito Real (Testnet)

```bash
# 1. Obtener dirección de depósito
DEPOSIT_INFO=$(curl -s http://localhost:3000/api/users/USER_ID/deposit)
ARB_ADDRESS=$(echo $DEPOSIT_INFO | jq -r '.data.deposits[1].address')
BTC_ADDRESS=$(echo $DEPOSIT_INFO | jq -r '.data.deposits[0].address')

echo "Arbitrum address: $ARB_ADDRESS"
echo "Bitcoin address: $BTC_ADDRESS"

# 2. Enviar PYUSD en Arbitrum testnet a $ARB_ADDRESS
# 3. El sistema lo detectará automáticamente si el monitoreo está activo
# 4. O procesarlo manualmente con el endpoint /deposit/process
```

### Ejemplo de Flujo Completo con Withdrawals

```bash
# 1. Verificar balance del usuario antes del retiro
curl http://localhost:3000/api/users/USER_ID/balances | jq .
# Ejemplo de respuesta:
# {
#   "success": true,
#   "data": [
#     { "currency": "PYUSD-ARB", "amount": 100 },
#     { "currency": "USDT-ARB", "amount": 50 },
#     { "currency": "SAT-BTC", "amount": 0 }
#   ]
# }

# 2. Obtener información sobre límites y fees de retiro
curl http://localhost:3000/api/withdrawals/info | jq .

# 3. Validar el retiro antes de ejecutarlo (dry run)
curl -X POST http://localhost:3000/api/withdrawals/validate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "currency": "PYUSD-ARB",
    "amount": 10,
    "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }' | jq .
# Verificará que el usuario tenga fondos suficientes (incluyendo el fee)

# 4. Estimar el costo de gas para el retiro
curl -X POST http://localhost:3000/api/withdrawals/estimate-cost \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "PYUSD-ARB",
    "amount": 10,
    "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }' | jq .

# 5. Ejecutar el retiro
curl -X POST http://localhost:3000/api/withdrawals \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "currency": "PYUSD-ARB",
    "amount": 10,
    "destinationAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }' | jq .
# Guardar el TRANSACTION_ID de la respuesta

# 6. Verificar el estado del retiro
curl http://localhost:3000/api/withdrawals/TRANSACTION_ID | jq .
# Estado puede ser: pending, completed, o failed

# 7. Ver historial de retiros del usuario
curl http://localhost:3000/api/withdrawals/user/USER_ID | jq .

# 8. Verificar el nuevo balance del usuario
curl http://localhost:3000/api/users/USER_ID/balances | jq .
# El balance debería estar reducido por (amount + fee)

# 9. (Admin) Verificar balances de la hot wallet
curl http://localhost:3000/api/withdrawals/hot-wallet/balances | jq .
```

### Configuración Inicial de la Hot Wallet

```bash
# Antes de poder procesar retiros, necesitas configurar la hot wallet:

# 1. Crear archivo .env con la configuración
cat > .env << EOF
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/api-sendo
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# ⚠️ Hot Wallet para Withdrawals (clave privada SIN el prefijo 0x)
WITHDRAWAL_HOT_WALLET_PRIVATE_KEY=tu_clave_privada_aqui
EOF

# 2. Iniciar el servidor
npm start

# 3. Verificar que la hot wallet esté configurada
curl http://localhost:3000/api/withdrawals/hot-wallet/balances | jq .

# 4. Fondear la hot wallet (hacer esto en la blockchain real):
# - Enviar PYUSD a la dirección de la hot wallet
# - Enviar USDT a la dirección de la hot wallet
# - Enviar ETH para cubrir los costos de gas (al menos 0.1 ETH)

# 5. Verificar los fondos después de enviarlos
curl http://localhost:3000/api/withdrawals/hot-wallet/balances | jq .
```

### Manejo de Errores Comunes

```bash
# Error: Insufficient balance
# Solución: El usuario no tiene suficientes fondos (incluyendo el fee)
curl http://localhost:3000/api/users/USER_ID/balances | jq .

# Error: Withdrawal hot wallet not configured
# Solución: Falta configurar WITHDRAWAL_HOT_WALLET_PRIVATE_KEY en .env

# Error: Insufficient balance in hot wallet
# Solución: La hot wallet no tiene suficientes tokens para cubrir el retiro
curl http://localhost:3000/api/withdrawals/hot-wallet/balances | jq .
# Enviar más tokens a la hot wallet

# Error: Invalid destination address
# Solución: La dirección de destino no es una dirección Ethereum válida
# Verificar que sea formato 0x... con 40 caracteres hexadecimales
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia ISC.

## 👥 Autores

- Desarrollado para el proyecto SENDO

## 📞 Soporte

Para preguntas o soporte, por favor abre un issue en el repositorio.

---

**Nota**: Este proyecto está en desarrollo activo. Las funcionalidades y la API pueden cambiar.

