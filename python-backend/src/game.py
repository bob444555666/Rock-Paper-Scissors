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
SMARTNESS = {"easy": 0.0, "medium": 0.65, "hard": 0.82, "insane": 0.93}


def result_for(player_move, computer_move, variant="classic"):
    allowed = EXTENDED_MOVES if variant == "rpsls" else MOVES
    if player_move not in allowed or computer_move not in allowed:
        raise ValueError("Moves are not valid for this variant.")
    beats = RPSLS_BEATS if variant == "rpsls" else {k: (v,) for k, v in BEATS.items()}
    if player_move == computer_move:
        return "tie"
    return "win" if computer_move in beats[player_move] else "loss"


def counter_moves(predicted, variant):
    allowed = EXTENDED_MOVES if variant == "rpsls" else MOVES
    beats = RPSLS_BEATS if variant == "rpsls" else {k: (v,) for k, v in BEATS.items()}
    return [candidate for candidate in allowed if predicted in beats[candidate]]


def predict_move(level, history, variant="classic", rounds=None):
    """Predict only from completed rounds; never use the current player's move."""
    allowed = EXTENDED_MOVES if variant == "rpsls" else MOVES
    rng = random.SystemRandom()
    rounds = rounds or []

    # Insane mode: combine sequence learning with a probabilistic behavioural prior.
    if level == "insane" and rounds:
        last = rounds[-1]
        previous_move = last.get("you")
        previous_ai = last.get("computer")
        previous_result = last.get("result")
        psychological = None
        if previous_result == "win" and previous_move in allowed:
            psychological = previous_move  # Win bias: repeat the winning move.
        elif previous_result == "loss" and previous_ai in allowed:
            likely_switch = counter_moves(previous_ai, variant)
            if likely_switch:
                psychological = rng.choice(likely_switch)  # Loss bias: counter the AI's last winning move.
        elif previous_result == "tie" and previous_move in allowed:
            likely_switch = counter_moves(previous_move, variant)
            if likely_switch:
                psychological = rng.choice(likely_switch)  # Tie bias: move that beats the tied move.
        markov = _markov_prediction(history, allowed, order=2) or _markov_prediction(history, allowed, order=1)
        candidates = [x for x in (psychological, markov) if x in allowed]
        if candidates:
            return rng.choice(candidates), "Combined sequence learning with a probabilistic post-round behaviour model."

    if level == "hard":
        predicted = _markov_prediction(history, allowed, order=2) or _markov_prediction(history, allowed, order=1)
        if predicted:
            return predicted, "Used conditional move frequencies from repeated one- and two-move sequences."
    if level == "medium":
        recent = history[-20:]
        if recent:
            counts = {move: recent.count(move) for move in allowed}
            best = max(counts.values())
            return rng.choice([move for move, count in counts.items() if count == best]), "Used recent overall move frequencies."
    return rng.choice(allowed), "Easy mode selects randomly without tracking player patterns."


def _markov_prediction(history, allowed, order=1):
    if len(history) <= order:
        return None
    rng = random.SystemRandom()
    prefix = tuple(history[-order:])
    counts = {move: 0 for move in allowed}
    for index in range(len(history) - order):
        if tuple(history[index:index + order]) == prefix:
            following = history[index + order]
            if following in counts:
                counts[following] += 1
    if not sum(counts.values()):
        return None
    best = max(counts.values())
    return rng.choice([move for move, count in counts.items() if count == best])


def _make_round(move, variant, level, history, rounds=None):
    allowed = EXTENDED_MOVES if variant == "rpsls" else MOVES
    if move not in allowed:
        raise ValueError("Move is not valid for this variant.")
    if level not in SMARTNESS:
        level = "easy"
    if not isinstance(history, list) or any(item not in allowed for item in history):
        raise ValueError("History must contain valid moves for this variant.")
    history = history[-50:]
    rng = random.SystemRandom()
    predicted, reason = predict_move(level, history, variant, rounds)
    counters = counter_moves(predicted, variant)
    if level == "easy" or not history:
        computer_move = rng.choice(allowed)
    elif level == "medium":
        computer_move = rng.choice(counters) if counters and rng.random() < SMARTNESS[level] else rng.choice(allowed)
    elif level == "hard":
        computer_move = rng.choice(counters) if counters and rng.random() < SMARTNESS[level] else rng.choice(allowed)
    else:
        computer_move = rng.choice(counters) if counters and rng.random() < SMARTNESS[level] else rng.choice(allowed)
    result = result_for(move, computer_move, variant)
    total = len(rounds or []) + 1
    wins = sum(1 for r in (rounds or []) if r.get("result") == "win") + (result == "win")
    losses = sum(1 for r in (rounds or []) if r.get("result") == "loss") + (result == "loss")
    ties = sum(1 for r in (rounds or []) if r.get("result") == "tie") + (result == "tie")
    return {
        "playerMove": move, "computerMove": computer_move, "result": result,
        "engine": "python", "level": level, "variant": variant,
        "predictedMove": predicted, "reason": reason,
        "telemetry": {"rounds": total, "playerWins": wins, "aiWins": losses, "ties": ties},
    }


def play_round(move, level="easy", history=None, rounds=None):
    return _make_round(move, "classic", level, history or [], rounds)


def play_custom_round(move, variant="classic", level="medium", history=None, style="random", rounds=None):
    if variant not in ("classic", "rpsls"):
        raise ValueError("Variant must be classic or rpsls.")
    if style not in ("random", "counter", "copy", "chaos"):
        style = "random"
    if style == "random":
        return _make_round(move, variant, level, history or [], rounds)
    allowed = EXTENDED_MOVES if variant == "rpsls" else MOVES
    if move not in allowed:
        raise ValueError("Move is not valid for this variant.")
    history = history or []
    rng = random.SystemRandom()
    if not isinstance(history, list) or any(item not in allowed for item in history):
        raise ValueError("History must contain valid moves for this variant.")
    predicted, reason = predict_move(level, history[-50:], variant, rounds)
    if style == "copy" and history and rng.random() < 0.55:
        computer_move = history[-1]
    elif style == "counter" and history:
        counters = counter_moves(max(set(history), key=history.count), variant)
        computer_move = rng.choice(counters) if counters else rng.choice(allowed)
    elif style == "chaos" and rng.random() < 0.5:
        computer_move = rng.choice(allowed)
    else:
        return _make_round(move, variant, level, history, rounds)
    result = result_for(move, computer_move, variant)
    return {"playerMove": move, "computerMove": computer_move, "result": result,
            "engine": "python", "level": level, "variant": variant,
            "predictedMove": predicted, "reason": reason,
            "telemetry": {"rounds": len(rounds or []) + 1,
                          "playerWins": sum(r.get("result") == "win" for r in (rounds or [])) + (result == "win"),
                          "aiWins": sum(r.get("result") == "loss" for r in (rounds or [])) + (result == "loss"),
                          "ties": sum(r.get("result") == "tie" for r in (rounds or [])) + (result == "tie")}}


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
