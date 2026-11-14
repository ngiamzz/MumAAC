/** Speak with the device's own voice; works offline on iPhone and iPad. */
export function speak(text: string, rate: number): void {
  if (!text.trim() || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  window.speechSynthesis.speak(u);
}
