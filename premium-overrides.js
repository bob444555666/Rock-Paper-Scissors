
const PERMANENT_PREMIUM_USERNAMES = new Set([
  "ashton"
]);

export function isPermanentPremiumUsername(username) {
  return (
    typeof username === "string" &&
    PERMANENT_PREMIUM_USERNAMES.has(
      username.trim().toLowerCase()
    )
  );
}
