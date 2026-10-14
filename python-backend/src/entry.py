import hashlib
import json
import random
from datetime import datetime, timezone
from urllib.parse import urlparse

from workers import Response, WorkerEntrypoint

SITE_ORIGIN = "https://www.stone-paper-scissors.com"
MOVES = ("rock", "paper", "scissors")
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}
COUNTER = {"rock": "paper", "paper": "scissors", "scissors": "rock"}
SMARTNESS = {"easy": 0.0, "medium": 0.5, "hard": 0.75, "insane": 0.95}


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


def result_for(player_move, computer_move):
    if player_move == computer_move:
        return "tie"
    return "win" if BEATS[player_move] == computer_move else "loss"


def predict_move(level, history):
    if level == "insane" and len(history) >= 3:
        counts = {move: 0 for move in MOVES}
        a, b = history[-2], history[-1]
        for index in range(len(history) - 2):
            if history[index] == a and history[index + 1] == b:
                counts[history[index + 2]] += 1
        if sum(counts.values()):
            best = max(counts.values())
            return random.SystemRandom().choice(
                [move for move, count in counts.items() if count == best]
            )

    if level in ("hard", "insane") and len(history) >= 2:
        counts = {move: 0 for move in MOVES}
        last = history[-1]
        for index in range(len(history) - 1):
            if history[index] == last:
                counts[history[index + 1]] += 1
        if sum(counts.values()):
            best = max(counts.values())
            return random.SystemRandom().choice(
                [move for move, count in counts.items() if count == best]
            )

    recent = history[-10:] if level == "medium" else history
    counts = {move: recent.count(move) for move in MOVES}
    best = max(counts.values(), default=0)
    if best == 0:
        return random.SystemRandom().choice(MOVES)
    return random.SystemRandom().choice(
        [move for move, count in counts.items() if count == best]
    )


def play_round(move, level="easy", history=None):
    if move not in MOVES:
        raise ValueError("Move must be rock, paper, or scissors.")
    if level not in SMARTNESS:
        level = "easy"
    history = [item for item in (history or [])[-50:] if item in MOVES]
    rng = random.SystemRandom()
    if history and rng.random() < SMARTNESS[level]:
        computer_move = COUNTER[predict_move(level, history)]
    else:
        computer_move = rng.choice(MOVES)
    return {
        "playerMove": move,
        "computerMove": computer_move,
        "result": result_for(move, computer_move),
        "engine": "python",
        "level": level,
    }


def daily_challenge(now=None):
    today = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).date().isoformat()
    digest = hashlib.sha256(("stone-paper-scissors:" + today).encode("utf-8")).digest()
    move = MOVES[digest[0] % len(MOVES)]
    return {
        "date": today,
        "id": digest.hex()[:12],
        "title": "Daily Counter",
        "goal": "Win a round using " + move + ".",
        "requiredMove": move,
        "rewardXp": 75,
        "timezone": "UTC",
    }


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        url = urlparse(request.url)
        path = url.path.rstrip("/") or "/"
        method = request.method.upper()

        if method == "OPTIONS":
            return Response(
                None,
                status=204,
                headers={
                    "Access-Control-Allow-Origin": SITE_ORIGIN,
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Max-Age": "86400",
                    "Vary": "Origin",
                },
            )

        if request.headers.get("Origin") not in (None, SITE_ORIGIN):
            return json_response({"error": "Origin not allowed."}, 403)

        if path == "/health" and method == "GET":
            return json_response({
                "ok": True,
                "service": "rps-python-api",
                "runtime": "python-workers",
                "version": 1,
            })

        if path == "/v1/daily-challenge" and method == "GET":
            return json_response(daily_challenge())

        if path == "/v1/rules" and method == "GET":
            return json_response({
                "moves": list(MOVES),
                "beats": BEATS,
                "levels": list(SMARTNESS.keys()),
                "engine": "python",
            })

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
            if not isinstance(history, list) or len(history) > 100:
                return json_response({"error": "History must be a list of at most 100 moves."}, 400)
            if any(item not in MOVES for item in history):
                return json_response({"error": "History contains an invalid move."}, 400)
            return json_response(play_round(move, level, history))

        return json_response({"error": "Not found."}, 404)
