import type { Settings } from "./shared";
export function hasSecret(text: string): boolean {
  return /(?:sk-[a-zA-Z0-9_-]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|password|token)\s*[:=]\s*["']?[^\s"']{12,})/i.test(
    text,
  );
}
export function excluded(app: string, list: string[]): boolean {
  return list.some((x) => app.toLowerCase().includes(x.toLowerCase()));
}
export class Rules {
  private last = new Map<string, number>();
  private switches: number[] = [];
  private active = 0;
  reset() {
    this.switches = [];
    this.active = 0;
    this.last.clear();
  }
  check(
    input: { now: number; idle: number; switched: boolean; secret: boolean },
    s: Settings,
  ): string[] {
    if (s.paused) return [];
    const out: string[] = [];
    const emit = (key: string, text: string, cooldown: number) => {
      if (input.now - (this.last.get(key) ?? -Infinity) >= cooldown) {
        this.last.set(key, input.now);
        out.push(text);
      }
    };
    this.active = input.idle > 120 ? 0 : this.active + 5;
    if (s.breaks && this.active >= 3000)
      emit(
        "break",
        "You have been active for 50 minutes. A short stretch might help.",
        3000000,
      );
    this.switches = this.switches.filter((t) => input.now - t < 60000);
    if (input.switched) this.switches.push(input.now);
    if (s.switching && this.switches.length >= 12)
      emit(
        "switch",
        "A lot of app switching in the last minute. Choose one small next step.",
        300000,
      );
    if (s.secrets && input.secret)
      emit(
        "secret",
        "Your clipboard may contain a credential. Check before pasting; you can clear it from Privacy.",
        60000,
      );
    return out;
  }
}
