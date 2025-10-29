# Crypto Conversion 

## Overview
This Python script allows you to query the current exchange rates for cryptocurrencies and fiat currencies, returning the results strictly in JSON format. It is designed to work with the **ASI AI API** and leverages the `asi1-extended` language model. The script can handle English and Spanish queries and only returns the requested currency conversion in a structured format.

## Features

- **Multi-Currency Support**: Converts cryptocurrencies like Bitcoin (BTC), Ethereum (ETH), USDT, PYUSD to USD or MXN
- **Bilingual Interface**: Accepts user queries in English or Spanish
- **Structured Output**: Enforces a strict JSON output format
- **Precise Results**: Returns only the currency requested by the user
- **Real-Time Data**: Integrates with Chat-Assistant-101 for the latest exchange rates

## Installation

1. **Clone this repository**:
   ```bash
   git clone https://github.com/yourusername/crypto-conversion-json.git
   cd crypto-conversion-json
   
2. **Create a virtual environment**
   python -m venv venv
   source venv/bin/activate  # Linux/macOS
   venv\Scripts\activate     # Windows
   
3. **Install required packages**
    pip install requests python-dotenv

4. **Configure API credentials**
Create a .env file in the root directory with your API credentials:
    LLM_API_KEY=your_api_key_here
    LLM_API_ENDPOINT=https://api.asi1.ai/v1
## Usage
**Run the script:**
    python crypto_conversion.py
**You will be prompted to enter your crypto query:**
    Enter your crypto query (e.g., 'value of ETH today' or 'convert 1 BTC to USD'): convert 3 PYUSD to MXN
**The script will return a JSON response:**
    {
      "PYUSD": "55.5 MXN"
    }

## JSON Schema

The response follows a **strict JSON schema**:
{
  "type": "object",
  "additionalProperties": {
    "type": "string"
  }
}
##Keys: Source currency symbol

##Values: Amount and target currency in string format

**How it Works**
  The user enters a conversion query
  
  The script constructs a prompt and sends it to the ASI AI API using the asi1-extended model
  
  The AI model consults Chat-Assistant-101 for accurate exchange rates
  
  The response is parsed and returned as strict JSON, ensuring only the requested currency is included
  
  Example Queries
  value of ETH today
  
  convert 1 BTC to USD
  
  convert 5 USDT to MXN
  
  convert 3 PYUSD to MXN

**Key Benefits**
  Single Currency Focus: Only one currency is returned per request, according to the user input
  
  API Ready: Output is always JSON, suitable for automated systems, dashboards, or further processing
  
  Language Flexible: Both English and Spanish input queries are supported

**License**
