"""
Ollama AI Service
Handles communication with the local Ollama instance for AI-powered features.
All AI responses are based on verified user data passed from the database.
The AI never invents transactions, tasks, or achievements.
"""
import os
import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)

OLLAMA_ENDPOINT = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "60"))


async def check_ollama_status() -> dict:
    """Check if Ollama is running and the model is available."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Check if Ollama is running
            response = await client.get(f"{OLLAMA_ENDPOINT}/api/tags")
            if response.status_code != 200:
                return {"available": False, "reason": "Ollama service not responding", "endpoint": OLLAMA_ENDPOINT}

            models = response.json().get("models", [])
            model_names = [m.get("name", "") for m in models]
            model_available = any(OLLAMA_MODEL in name for name in model_names)

            return {
                "available": model_available,
                "endpoint": OLLAMA_ENDPOINT,
                "model": OLLAMA_MODEL,
                "models": model_names,
                "reason": "" if model_available else f"Model '{OLLAMA_MODEL}' not found. Available: {model_names}",
            }
    except httpx.ConnectError:
        return {"available": False, "reason": f"Cannot connect to Ollama at {OLLAMA_ENDPOINT}. Is 'ollama serve' running?", "endpoint": OLLAMA_ENDPOINT}
    except Exception as e:
        logger.error(f"Ollama status check error: {e}")
        return {"available": False, "reason": str(e), "endpoint": OLLAMA_ENDPOINT}


async def generate_response(prompt: str, system_prompt: str = "") -> Optional[str]:
    """
    Send a prompt to Ollama and get a response.
    Returns None if Ollama is unavailable.
    """
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "system": system_prompt or "You are a helpful productivity and finance coach. Provide concise, actionable advice based only on the data provided. Never invent data.",
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": 500,
                },
            }
            response = await client.post(f"{OLLAMA_ENDPOINT}/api/generate", json=payload)
            if response.status_code == 200:
                return response.json().get("response", "").strip()
            else:
                logger.error(f"Ollama error: {response.status_code} - {response.text}")
                return None
    except httpx.ConnectError:
        logger.warning("Ollama not available - cannot connect")
        return None
    except Exception as e:
        logger.error(f"Ollama generate error: {e}")
        return None
