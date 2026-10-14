import unittest
from datetime import datetime, timezone

from src.game import daily_challenge, play_custom_round, play_round, result_for


class GameRulesTests(unittest.TestCase):
    def test_win_loss_tie(self):
        self.assertEqual(result_for("rock", "scissors"), "win")
        self.assertEqual(result_for("rock", "paper"), "loss")
        self.assertEqual(result_for("rock", "rock"), "tie")

    def test_extended_rules(self):
        self.assertEqual(result_for("spock", "scissors", "rpsls"), "win")
        self.assertEqual(result_for("lizard", "spock", "rpsls"), "win")
        self.assertEqual(result_for("rock", "rock", "rpsls"), "tie")

    def test_round_response_shape(self):
        result = play_round("paper", "easy", [])
        self.assertEqual(result["playerMove"], "paper")
        self.assertIn(result["computerMove"], ("rock", "paper", "scissors"))
        self.assertIn(result["result"], ("win", "loss", "tie"))
        self.assertEqual(result["engine"], "python")

    def test_custom_round_response_shape(self):
        result = play_custom_round("lizard", "rpsls", "hard", ["rock"], "counter")
        self.assertEqual(result["playerMove"], "lizard")
        self.assertIn(result["computerMove"], ("rock", "paper", "scissors", "lizard", "spock"))
        self.assertIn(result["result"], ("win", "loss", "tie"))
        self.assertEqual(result["engine"], "python")
        self.assertEqual(result["variant"], "rpsls")

    def test_round_rejects_invalid_move(self):
        with self.assertRaises(ValueError):
            play_round("lizard")

    def test_custom_round_rejects_invalid_move(self):
        with self.assertRaises(ValueError):
            play_custom_round("spock", "classic")

    def test_daily_challenge_is_stable_for_same_utc_day(self):
        moment = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)
        first = daily_challenge(moment)
        self.assertEqual(first, daily_challenge(moment))
        self.assertIn(first["requiredMove"], ("rock", "paper", "scissors"))
        self.assertEqual(first["rewardXp"], 75)


if __name__ == "__main__":
    unittest.main()
