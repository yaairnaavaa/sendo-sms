from fastapi import FastAPI, Request
from dotenv import load_dotenv
import os, json, requests

# Cargar variables de entorno
load_dotenv()

app = FastAPI()

# Variables del entorno
LLM_API_ENDPOINT = os.getenv("LLM_API_ENDPOINT", "https://api.asi1.ai/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "your-api-key")
LLM_MODEL = "asi1-extended"

headers = {
    "Authorization": f"Bearer {LLM_API_KEY}",
    "Content-Type": "application/json",
}

response_format = {
    "type": "json_schema",
    "json_schema": {
        "name": "crypto_conversion",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": {"type": "string"},
        },
    },
}

@app.post("/crypto")
async def crypto_query(request: Request):
    body = await request.json()
    user_input = body.get("query")

    prompt = (
        "You can speak English and Spanish. "
        "Return ONLY valid JSON where each key is the source currency and the value is "
        "a string with the amount and the target currency, e.g., {\"PYUSD\": \"55.5 MXN\"}. "
        "No text, no markdown, no explanations. "
        f"User request: {user_input}. "
        "Available currencies: Bitcoin (BTC), Ethereum (ETH), USDT, PYUSD, USD, MXN."
    )

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": "Consult with Chat-Assistand-101. Return ONLY valid JSON in the specified format."},
            {"role": "user", "content": prompt},
        ],
        "response_format": response_format,
    }

    resp = requests.post(
        f"{LLM_API_ENDPOINT}/chat/completions",
        headers=headers,
        json=payload,
        timeout=60,
    )

    if not resp.ok:
        return {"error": f"LLM API request failed: {resp.status_code}", "details": resp.text}

    data = resp.json()
    content = (
        (data.get("choices") or [{}])[0]
        .get("message", {})
        .get("content", "")
    )

    try:
        parsed = json.loads(content) if content else None
    except Exception:
        parsed = None

    return parsed or {"error": "Invalid response"}
