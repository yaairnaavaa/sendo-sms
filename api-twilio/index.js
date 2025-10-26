import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import twilio from "twilio";
import morgan from 'morgan';
import fetch from "node-fetch"; // npm install node-fetch
const { MessagingResponse } = twilio.twiml;

dotenv.config();
const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configurar cliente Twilio
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.get("/", (req, res) => {
  res.send("Bienvenido a la API de Twilio");
});

app.get("/sms", (req, res) => {
  res.send("✅ Endpoint /sms activo, pero recuerda que Twilio usa POST");
});

app.post("/sms", async (req, res) => {
  const from = req.body.From || "";
  const incomingMsgSMS = req.body.Body?.trim() || "";
  const incomingMsgLower = incomingMsgSMS.toLowerCase();
  const twiml = new MessagingResponse();

  console.log("📩 From:", from);
  console.log("📩 Body:", incomingMsgSMS);

  // MENSAJE DE BIENVENIDA
  if (incomingMsgLower === "hello" || incomingMsgLower === "start") {
    twiml.message(
      "👋 Welcome to Sendo-SMS! Please choose an option:\n\n" +
      "1️⃣ Balance (To check balance, type: BALANCE)\n\n" +
      "2️⃣ Deposit (Add funds: DEPOSIT CURRENCY, e.g., DEPOSIT USDT-ARB)\n\n" +
      "3️⃣ Transfer (Send funds: TRANSFER TO_PHONE_NUMBER CURRENCY AMOUNT, e.g., TRANSFER +521234567890 USDT-ARB 50)\n\n" +
      "4️⃣ Withdraw (Withdraw funds: WITHDRAW CURRENCY AMOUNT ADDRESS, e.g., WITHDRAW USDT-ARB 10 0xb37...2000)\n\n" +
      "5️⃣ Convert crypto to another crypto (Supported: PYUSD, USD, BTC, ETH, MXN, e.g., CONVERT 5 BTC TO PYUSD)\n\n" +
      "To register, type: REGISTER Name Email@example.com"
    );
  }
  // REGISTRO DE USUARIO
  else if (incomingMsgLower.startsWith("register")) {
    const parts = incomingMsgSMS.split(/\s+/);
    if (parts.length < 3) {
      twiml.message("❌ Please send in format: REGISTER Name Email@example.com");
    } else {
      const email = parts[parts.length - 1]; // última palabra
      const name = parts.slice(1, parts.length - 1).join(" "); // todas las palabras entre REGISTER y email

      try {
        // 1️⃣ Crear usuario principal
        const response = await fetch("https://sendo-sms.vercel.app/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: from,
            name,
            email
          }),
        });

        const data = await response.json();

        if (data.success) {
          const userId = data.data._id;

          // 2️⃣ Crear cuenta Arbitrum
          try {
            await fetch(`https://sendo-sms.vercel.app/api/users/${userId}/arbitrum-account`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          } catch (err) {
            console.error("❌ Error creating Arbitrum account:", err);
          }

          // 3️⃣ Crear cuenta Bitcoin
          try {
            await fetch(`https://sendo-sms.vercel.app/api/users/${userId}/bitcoin-account`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          } catch (err) {
            console.error("❌ Error creating Bitcoin account:", err);
          }

          twiml.message(
            `✅ Registered successfully!\nName: ${name}\nEmail: ${email}\nPhone: ${from}\n` +
            `Your Arbitrum and Bitcoin accounts have been created.`
          );
        } else {
          twiml.message(`❌ Could not register: ${data.error || "Unknown error"}`);
        }
      } catch (error) {
        console.error(error);
        twiml.message("❌ Error registering. Please try again later.");
      }
    }
  }
  // BALANCE CON ID DE USUARIO
  else if (incomingMsgLower.startsWith("balance")) {
    try {
      const response = await fetch(`https://sendo-sms.vercel.app/api/users/${from}/balances`);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        let message = `💰 Balance for user ${from}:\n`;
        data.data.forEach(item => {
          message += `- ${item.currency}: ${item.amount}\n`;
        });
        twiml.message(message);
      } else {
        twiml.message(
          "❌ Account not found. Please register first by sending: REGISTER Name Email@example.com"
        );
      }
    } catch (error) {
      console.error(error);
      twiml.message(
        "❌ Error fetching balance. Please ensure your account exists or register first: REGISTER Name Email@example.com"
      );
    }
  }
  // DEPOSIT
  else if (incomingMsgLower.startsWith("deposit")) {
    const parts = incomingMsgSMS.split(/\s+/);
    if (parts.length !== 2) {
      twiml.message("❌ Please send in format: DEPOSIT CURRENCY\nExample: DEPOSIT USDT-ARB");
    } else {
      const currency = parts[1].toUpperCase();

      // Validamos moneda
      if (!["PYUSD-ARB", "USDT-ARB", "SAT-BTC"].includes(currency)) {
        twiml.message("❌ Invalid currency. Valid options: PYUSD-ARB, USDT-ARB, SAT-BTC");
        return;
      }

      try {
        // Llamamos a la API para obtener direcciones de depósito
        const response = await fetch(`https://sendo-sms.vercel.app/api/users/${from}/deposit`);
        const data = await response.json();

        console.log("data");
        console.log(data);

        if (!data.success || !data.data?.deposits) {
          twiml.message("❌ Could not retrieve deposit info. Please try again later.");
          return;
        }

        // Mapeo entre la moneda del comando y el 'asset' del API
        const assetMap = {
          "PYUSD-ARB": "PYUSD",
          "USDT-ARB": "USDT",
          "SAT-BTC": "BTC"
        };

        const assetToFind = assetMap[currency];
        const depositInfo = data.data.deposits.find(d => d.asset === assetToFind);

        if (!depositInfo) {
          twiml.message(`❌ Deposit information not found for ${currency}.`);
          return;
        }

        // Construimos respuesta para el usuario
        const msg = `💰 Deposit Information\n\n` +
          `Currency: ${currency}\n\n` +
          `Network: ${depositInfo.network}\n\n` +
          `Address: ${depositInfo.address}\n\n` +
          `Minimum Deposit: ${depositInfo.minimumDeposit}\n\n` +
          `📋 ${depositInfo.instructions || ""}`;

        twiml.message(msg.trim());
      } catch (error) {
        console.error(error);
        twiml.message("❌ Error retrieving deposit address. Please try again later.");
      }
    }
  }

  // TRANSFER
  else if (incomingMsgLower.startsWith("transfer")) {
    const parts = incomingMsgSMS.split(/\s+/);
    if (parts.length !== 4) {
      twiml.message("❌ Please send in format: TRANSFER TO_PHONE_NUMBER CURRENCY AMOUNT\nExample: TRANSFER +521234567890 USDT-ARB 50");
    } else {
      const toPhoneNumber = parts[1];
      const currency = parts[2].toUpperCase();
      const amount = parseFloat(parts[3]);

      if (!["PYUSD-ARB", "USDT-ARB", "SAT-BTC"].includes(currency) || isNaN(amount) || amount <= 0) {
        twiml.message("❌ Invalid currency or amount. Valid currencies: PYUSD-ARB, USDT-ARB, SAT-BTC");
      } else {
        try {
          const response = await fetch(`https://sendo-sms.vercel.app/api/users/${from}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "transfer",
              currency,
              amount,
              toPhoneNumber
            })
          });

          const data = await response.json();

          if (data.success) {
            twiml.message(`✅ Transfer successful!\nAmount: ${amount} ${currency}\nTo: ${toPhoneNumber}`);
          } else {
            twiml.message(`❌ Could not transfer: ${data.error || "Unknown error"}`);
          }
        } catch (error) {
          console.error(error);
          twiml.message("❌ Error processing transfer. Please try again later.");
        }
      }
    }
  }
  // WITHDRAW
  else if (incomingMsgLower.startsWith("withdraw")) {
    const parts = incomingMsgSMS.split(/\s+/);

    // Formato esperado: WITHDRAW CURRENCY AMOUNT ADDRESS
    if (parts.length !== 4) {
      twiml.message("❌ Please send in format:\nWITHDRAW CURRENCY AMOUNT ADDRESS\n\nExample:\nWITHDRAW USDT-ARB 50 0x742d35....0bEb");
    } else {
      const currency = parts[1].toUpperCase();
      const amount = parseFloat(parts[2]);
      const destinationAddress = parts[3];

      // Validar campos
      if (!["PYUSD-ARB", "USDT-ARB", "SAT-BTC"].includes(currency) || isNaN(amount) || amount <= 0) {
        twiml.message("❌ Invalid currency or amount. Valid currencies: PYUSD-ARB, USDT-ARB, SAT-BTC");
        return;
      }

      if (!destinationAddress || destinationAddress.length < 10) {
        twiml.message("❌ Invalid destination address.");
        return;
      }

      try {
        // POST al nuevo endpoint
        const response = await fetch(`https://sendo-sms.vercel.app/api/withdrawals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: from, // Usamos el número del remitente como userId
            currency,
            amount,
            destinationAddress
          })
        });

        const data = await response.json();

        if (data.success) {
          twiml.message(
            `✅ Withdrawal requested successfully!\n\nAmount: ${amount} ${currency}\nTo: ${destinationAddress}`
          );
        } else {
          twiml.message(`❌ Withdrawal failed: ${data.error || "Unknown error"}`);
        }
      } catch (error) {
        console.error(error);
        twiml.message("❌ Error processing withdrawal. Please try again later.");
      }
    }
  }

  // CONVERT
  else if (incomingMsgLower.startsWith("convert")) {
    const match = incomingMsgSMS.match(/convert\s+(\d+(\.\d+)?)\s+(\w+)\s+to\s+(\w+)/i);
    if (!match) {
      twiml.message("❌ Invalid format. Example: CONVERT 5 BTC TO PYUSD");
    } else {
      const amount = parseFloat(match[1]);
      const fromCurrency = match[3].toUpperCase();
      const toCurrency = match[4].toUpperCase();
      const query = `convert ${amount} ${fromCurrency} to ${toCurrency}`;

      try {
        const response = await fetch("https://api-cryptocurrency.vercel.app/crypto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        });

        const data = await response.json();

        if (data[fromCurrency]) {
          twiml.message(`🔄 Conversion result: ${amount} ${fromCurrency} = ${data[fromCurrency]}`);
        } else {
          twiml.message("❌ Could not get conversion result. Try again later.");
        }
      } catch (error) {
        console.error(error);
        twiml.message("❌ Error connecting to conversion API. Please try again later.");
      }
    }
  }

  // COMANDO NO RECONOCIDO
  else {
    twiml.message("❓ Command not recognized. Type 'MENU' to see available options.");
  }

  res.type("text/xml").send(twiml.toString());
});

// ENDPOINT PARA ENVIAR MENSAJE MANUAL
app.post("/send", async (req, res) => {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: "Faltan campos: to y body son requeridos." });
    }

    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    console.log("✅ Mensaje enviado:", message.sid);
    res.json({ success: true, sid: message.sid });
  } catch (err) {
    console.error("❌ Error al enviar SMS:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("🚀 Servidor corriendo en http://localhost:3000"));
