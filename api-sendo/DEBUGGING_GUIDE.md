# 🐛 Guía de Debugging - Sistema de Monitoreo

Esta guía te ayudará a diagnosticar por qué un depósito PYUSD-ARB no fue detectado.

## 🔍 Herramientas Disponibles

### 1. **Debug Endpoint** - Verificar Estado del Sistema
```bash
curl http://localhost:3000/api/monitor/debug | jq
```

**Te muestra:**
- ✅ Si los monitores están activos
- ✅ Último bloque verificado
- ✅ Si el RPC está funcionando
- ✅ Variables de entorno configuradas

**Ejemplo de respuesta:**
```json
{
  "monitors": {
    "arbitrum": {
      "active": true,
      "lastCheckedBlock": 392240000
    }
  },
  "rpc": {
    "working": true,
    "currentBlock": 392240500
  }
}
```

---

### 2. **Check Transaction Endpoint** - Verificar TX Específica
```bash
curl http://localhost:3000/api/monitor/check-tx/0xTU_TX_HASH | jq
```

**Te muestra:**
- ✅ Si la TX existe en blockchain
- ✅ Confirmaciones actuales
- ✅ Transfers de PYUSD/USDT en la TX
- ✅ Si está registrada en la BD
- ✅ A qué usuario pertenece

**Ejemplo:**
```bash
curl http://localhost:3000/api/monitor/check-tx/0xf805ebf1342d210f56aef2f7ed269c5566a7d7c5ee8e7456d1f88caef2d6ce26 | jq
```

---

### 3. **Script de Debug Standalone** - Análisis Completo
```bash
node scripts/debugDeposit.js 0xTU_TX_HASH
```

**Te muestra:**
1. ✅ Estado de la TX en blockchain
2. ✅ Todos los transfers PYUSD/USDT
3. ✅ Si las direcciones son usuarios
4. ✅ Si está en la base de datos
5. ✅ Recomendaciones específicas

**Ejemplo:**
```bash
node scripts/debugDeposit.js 0xf805ebf1342d210f56aef2f7ed269c5566a7d7c5ee8e7456d1f88caef2d6ce26
```

---

### 4. **Sync Endpoint** - Verificar Balances
```bash
# Solo verificar (no actualiza)
curl -X POST http://localhost:3000/api/monitor/sync | jq

# Verificar Y actualizar
curl -X POST http://localhost:3000/api/monitor/sync \
  -H "Content-Type: application/json" \
  -d '{"updateDB": true}' | jq
```

---

### 5. **Monitor Status** - Estado Básico
```bash
curl http://localhost:3000/api/monitor/status | jq
```

---

## 🚨 Checklist de Debugging

Cuando un depósito no se detecta, sigue estos pasos:

### ✅ PASO 1: Verificar que el monitor está corriendo
```bash
curl http://localhost:3000/api/monitor/status | jq
```

**Esperado:**
```json
{
  "arbitrum": {
    "active": true
  }
}
```

**Si `active: false`:**
```bash
curl -X POST http://localhost:3000/api/monitor/start
```

---

### ✅ PASO 2: Verificar el sistema completo
```bash
curl http://localhost:3000/api/monitor/debug | jq
```

**Verifica:**
- ✅ `monitors.arbitrum.active` = true
- ✅ `rpc.working` = true
- ✅ `rpc.currentBlock` está avanzando

**Si el RPC falla:**
- Verifica `ARBITRUM_RPC_URL` en `.env`
- Prueba con otro RPC
- Verifica rate limits

---

### ✅ PASO 3: Verificar la transacción específica
```bash
curl http://localhost:3000/api/monitor/check-tx/0xTU_TX_HASH | jq
```

**Revisa:**
- ✅ `blockchain.confirmations` >= 12
- ✅ `blockchain.transfers` contiene tu depósito
- ✅ `database.found` = true

**Si `database.found = false`:**
- El monitor no capturó el evento
- Continúa al Paso 4

---

### ✅ PASO 4: Análisis profundo con script
```bash
node scripts/debugDeposit.js 0xTU_TX_HASH
```

**El script te dirá exactamente qué pasó:**
1. Si la TX está en blockchain ✅
2. Si contiene transfers PYUSD/USDT ✅
3. Si la dirección es de un usuario ✅
4. Si está en la base de datos ✅
5. **Qué hacer para corregirlo** 🔧

---

### ✅ PASO 5: Sincronizar manualmente
Si el depósito existe en blockchain pero no en BD:

```bash
curl -X POST http://localhost:3000/api/monitor/sync \
  -H "Content-Type: application/json" \
  -d '{"updateDB": true}' | jq
```

---

## 🔧 Problemas Comunes y Soluciones

### ❌ Monitor no está corriendo
**Síntoma:** `"active": false`

**Solución:**
```bash
curl -X POST http://localhost:3000/api/monitor/start
```

---

### ❌ RPC no funciona
**Síntoma:** `"rpc.working": false` o rate limit errors

**Solución:**
```bash
# Cambiar a RPC público en .env
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# O usar Alchemy con plan pagado
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY

# Reiniciar servidor
```

---

### ❌ Dirección no es usuario
**Síntoma:** Script dice "NOT found in database"

**Problema:** La dirección de depósito no pertenece a ningún usuario

**Solución:**
Verifica que el usuario tenga una `arbitrumAddress` asignada:
```bash
curl http://localhost:3000/api/users | jq '.data[] | {name, arbitrumAddress}'
```

---

### ❌ Falta de confirmaciones
**Síntoma:** `confirmations < 12`

**Solución:**
Espera a que la transacción tenga 12 confirmaciones (≈3 minutos en Arbitrum).
El monitor actualizará automáticamente cuando alcance 12.

---

### ❌ Monitor perdió el evento
**Síntoma:** TX está en blockchain pero no en BD, confirmaciones > 12

**Causas posibles:**
1. Monitor se cayó cuando llegó el depósito
2. Server se reinició
3. RPC tuvo problemas temporales

**Solución:**
```bash
# Sincronizar manualmente
curl -X POST http://localhost:3000/api/monitor/sync \
  -H "Content-Type: application/json" \
  -d '{"updateDB": true}' | jq
```

---

## 📊 Logs del Servidor

El servidor ahora muestra logs detallados:

```
🔍 Starting Arbitrum monitoring...
   PYUSD Contract: 0x46850ad61c2b7d64d08c9c754f45254596696984
   USDT Contract: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
   RPC: https://arb1.arbitrum.io/rpc
   Starting from block 392240000
✅ Arbitrum monitoring active - listening for Transfer events

📥 PYUSD Transfer detected: 1.5 PYUSD to 0x2355...897e
💰 Deposit detected for user Test User 2:
   Currency: PYUSD-ARB
   Amount: 1.5
   TX Hash: 0xf805...ce26
   Block: 392240632
   Confirmations: 10/12
⏳ Deposit pending confirmations for Test User 2 (10/12)
```

**Busca en los logs:**
- `📥 PYUSD Transfer detected` - El evento fue capturado
- `💰 Deposit detected` - El usuario fue encontrado
- `✅ Deposit credited` - El balance fue actualizado
- `⏭️ Not a user address` - La dirección no pertenece a un usuario

---

## 🎯 Flujo de Debugging Rápido

```bash
# 1. Estado del sistema
curl http://localhost:3000/api/monitor/debug | jq

# 2. Verificar TX específica
curl http://localhost:3000/api/monitor/check-tx/0xTU_TX_HASH | jq

# 3. Si no está en BD, sincronizar
curl -X POST http://localhost:3000/api/monitor/sync \
  -H "Content-Type: application/json" \
  -d '{"updateDB": true}' | jq
```

---

## 💡 Tips de Producción

1. **Mantén logs persistentes:**
   ```bash
   npm start >> logs/server.log 2>&1
   ```

2. **Monitorea el estado regularmente:**
   ```bash
   # Cron job cada 5 minutos
   */5 * * * * curl -s http://localhost:3000/api/monitor/debug >> /var/log/monitor-health.log
   ```

3. **Alertas de monitor caído:**
   ```bash
   # Script que envía alerta si monitor no está activo
   ```

4. **Usa un RPC confiable:**
   - Alchemy Growth plan o superior
   - QuickNode
   - Infura con plan pagado

5. **Reinicia el servidor con PM2:**
   ```bash
   pm2 start npm --name "sendo-api" -- start
   pm2 logs sendo-api --lines 100
   ```

---

## 📞 ¿Necesitas ayuda?

Si después de seguir esta guía el problema persiste:

1. ✅ Copia el output de: `curl http://localhost:3000/api/monitor/debug | jq`
2. ✅ Copia el output de: `node scripts/debugDeposit.js 0xTX_HASH`
3. ✅ Copia los últimos 50 logs del servidor
4. ✅ Menciona qué dirección de usuario está afectada

Con esa información podemos diagnosticar cualquier problema.

