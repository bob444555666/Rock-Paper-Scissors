import hashlib
import random
from datetime import datetime, timezone

MOVES = ("rock", "paper", "scissors")
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}
COUNTER = {"rock": "paper", "paper": "scissors", "scissors": "rock"}
SMARTNESS = {"easy": 0.0, "medium": 0.5, "hard": 0.75, "insane": 0.95}


def result_for(player_move, computer_move):
    if player_move not in MOVES or computer_move not in MOVES:
        raise ValueError("Moves must be rock, paper, or scissors.")
    if player_move == computer_move:
        return "tie"
    return "win" if BEATS[player_move] == computer_move else "loss"


def predict_move(level, history):
    rng = random.SystemRandom()
    if level == "insane" and len(history) >= 3:
        counts = {move: 0 for move in MOVES}
        a, b = history[-2], history[-1]
        for index in range(len(history) - 2):
            if history[index] == a and history[index + 1] == b:
                counts[history[index + 2]] += 1
        if sum(counts.values()):
            best = max(counts.values())
            return rng.choice([move for move, count in counts.items() if count == best])

    if level in ("hard", "insane") and len(history) >= 2:
        counts = {move: 0 for move in MOVES}
        last = history[-1]
        for index in range(len(history) - 1):
            if history[index] == last:
                counts[history[index + 1]] += 1
        if sum(counts.values()):
            best = max(counts.values())
            return rng.choice([move for move, count in counts.items() if count == best])

    recent = history[-10:] if level == "medium" else history
    counts = {move: recent.count(move) for move in MOVES}
    best = max(counts.values(), default=0)
    if best == 0:
        return rng.choice(MOVES)
    return rng.choice([move for move, count in counts.items() if count == best])


def play_round(move, level="easy", history=None):
    if move not in MOVES:
        raise ValueError("Move must be rock, paper, or scissors.")
    if level not in SMARTNESS:
        level = "easy"
    if history is None:
        history = []
    if not isinstance(history, list) or any(item not in MOVES for item in history):
        raise ValueError("History must contain only valid moves.")
    history = history[-50:]
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
