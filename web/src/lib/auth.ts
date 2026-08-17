// Supabase Auth requires an email. Frame Perfect accounts are username +
// password only, so we derive a stable, non-routable email from the
// username and never show it to the user.
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const USERNAME_EMAIL_DOMAIN = "users.frame-perfect.invalid";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
