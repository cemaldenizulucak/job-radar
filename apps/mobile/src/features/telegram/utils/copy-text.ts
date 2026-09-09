export async function copyText(value: string): Promise<void> {
  const clipboard = (
    globalThis as {
      navigator?: { clipboard?: { writeText?: (text: string) => Promise<void> } };
    }
  ).navigator?.clipboard;

  if (!clipboard?.writeText) {
    throw new Error('clipboard unavailable');
  }

  await clipboard.writeText(value);
}
