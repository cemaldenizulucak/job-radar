export function extractEmailAddress(sender: string): string {
  const angled = sender.match(/<([^>]+)>/);
  const value = angled?.[1] ?? sender;
  return value.trim().toLowerCase();
}
