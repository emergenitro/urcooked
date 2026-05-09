export async function streamText(res, text, delayMs = 12) {
  for (const ch of text) {
    res.write(ch);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}
