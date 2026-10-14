import hashlib
import random
from datetime import datetime, timezone

MOVES = ("rock", "paper", "scissors")
EXTENDED_MOVES = ("rock", "paper", "scissors", "lizard", "spock")
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}
COUNTER = {"rock": "paper", "paper": "scissors", "scissors": "rock"}
RPSLS_BEATS = {
    "rock": ("scissors", "lizard"),
    "paper": ("rock", "spock"),
    "scissors": ("paper", "lizard"),
    "lizard": ("paper", "spock"),
    "spock": ("rock", "scissors"),
}
SMARTNESS = {"easy": 0.0, "medium": 0.5, "hard": 0.75, "insane": 0.95}


def result_for(player_move, computer_move, variant="classic"):
    allowed = EXTENDED_MOVES if variant == "rpsls" else MOVES
    if player_move not in allowed or computer_move not in allowed:
        raise ValueError("Moves are not valid for this variant.")
    beats = RPSLS_BEATS if variant == "rpsls" else {k: (v,) for k, v in BEATS.items()}
    if player_move == computer_move:
        return "tie"
    return "win" if computer_move in beats[player_move] else "loss"


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
    history = history or []
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


def play_custom_round(move, variant="classic", level="medium", history=None, style="random"):
    if variant not in ("classic", "rpsls"):
        raise ValueError("Variant must be classic or rpsls.")
    allowed = EXTENDED_MOVES if variant == "rpsls" else MOVES
    if move not in allowed:
        raise ValueError("Move is not valid for this variant.")
    if level not in SMARTNESS:
        level = "medium"
    if style not in ("random", "counter", "copy", "chaos"):
        style = "random"
    if not isinstance(history, list) or any(item not in allowed for item in history):
        raise ValueError("History must contain valid moves for this variant.")
    history = history[-50:]
    rng = random.SystemRandom()
    computer_move = None
    if history and style == "copy" and rng.random() < 0.55:
        computer_move = history[-1]
    if history and style == "counter":
        counts = {item: history.count(item) for item in allowed}
        most_common = max(allowed, key=lambda item: counts[item])
        counters = [item for item in allowed if most_common in RPSLS_BEATS.get(item, (BEATS.get(item),))]
        if counters:
            computer_move = rng.choice(counters)
    if style == "chaos" and rng.random() < 0.5:
        computer_move = rng.choice(allowed)
    if computer_move is None and history and rng.random() < SMARTNESS[level]:
        counts = {item: history.count(item) for item in allowed}
        most_common = max(allowed, key=lambda item: counts[item])
        counters = [item for item in allowed if most_common in RPSLS_BEATS.get(item, (BEATS.get(item),))]
        computer_move = rng.choice(counters) if counters else None
    if computer_move is None:
        computer_move = rng.choice(allowed)
    return {
        "playerMove": move,
        "computerMove": computer_move,
        "result": result_for(move, computer_move, variant),
        "engine": "python",
        "level": level,
        "variant": variant,
        "style": style,
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
