import json
from urllib.parse import urlparse

from workers import Response, WorkerEntrypoint
from game import BEATS, MOVES, SMARTNESS, daily_challenge, play_round

SITE_ORIGIN = "https://www.stone-paper-scissors.com"


def json_response(data, status=200):
    return Response(
        json.dumps(data, separators=(",", ":")),
        status=status,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": SITE_ORIGIN,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Vary": "Origin",
            "X-Content-Type-Options": "nosniff",
        },
    )


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        path = urlparse(request.url).path.rstrip("/") or "/"
        method = request.method.upper()
        origin = request.headers.get("Origin")

        if method == "OPTIONS":
            return Response(None, status=204, headers={
                "Access-Control-Allow-Origin": SITE_ORIGIN,
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin",
            })
        if origin not in (None, SITE_ORIGIN):
            return json_response({"error": "Origin not allowed."}, 403)

        if path == "/health" and method == "GET":
            return json_response({"ok": True, "service": "rps-python-api", "runtime": "python-workers", "version": 1})
        if path == "/v1/daily-challenge" and method == "GET":
            return json_response(daily_challenge())
        if path == "/v1/rules" and method == "GET":
            return json_response({"moves": list(MOVES), "beats": BEATS, "levels": list(SMARTNESS), "engine": "python"})
        if path == "/v1/round" and method == "POST":
            try:
                body = await request.json()
            except Exception:
                return json_response({"error": "Request body must be valid JSON."}, 400)
            if not isinstance(body, dict):
                return json_response({"error": "Request body must be a JSON object."}, 400)
            move = body.get("move")
            level = body.get("level", "easy")
            history = body.get("history", [])
            if not isinstance(move, str) or move not in MOVES:
                return json_response({"error": "Move must be rock, paper, or scissors."}, 400)
            if not isinstance(level, str):
                return json_response({"error": "Level must be a string."}, 400)
            if not isinstance(history, list) or len(history) > 100 or any(item not in MOVES for item in history):
                return json_response({"error": "History must contain at most 100 valid moves."}, 400)
            return json_response(play_round(move, level, history))
        return json_response({"error": "Not found."}, 404)
