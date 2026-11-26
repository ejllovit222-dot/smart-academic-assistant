"""Thin Gemini client. The API key is read from the server environment only."""
import json
import os
import re

import requests


class AIError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def _parse_json(text):
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text)


def generate(contents, system=None, json_mode=False, temperature=0.6):
    key = os.getenv("GEMINI_API_KEY", "")
    if not key or key.startswith("your_"):
        raise AIError("Gemini API key is not configured. Add GEMINI_API_KEY to backend/.env and restart the server.", 503)
    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    print("DEBUG: Gemini model being used:", repr(model), flush=True)
    if isinstance(contents, str):
        contents = [{"role": "user", "parts": [{"text": contents}]}]
    body = {"contents": contents, "generationConfig": {"temperature": temperature}}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"
    try:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key, "Content-Type": "application/json"},
            json=body,
            timeout=60,
        )
    except requests.RequestException as e:
        raise AIError(f"Could not reach Gemini: {e}")
    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message", "")
        except ValueError:
            msg = r.text[:200]
        raise AIError(f"Gemini error ({r.status_code}): {msg}")
    try:
        text = "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])
    except (KeyError, IndexError, ValueError):
        raise AIError("Gemini returned an empty response (it may have been blocked by safety filters).")
    if json_mode:
        try:
            return _parse_json(text)
        except json.JSONDecodeError:
            raise AIError("Gemini returned malformed JSON. Please try again.")
    return text
