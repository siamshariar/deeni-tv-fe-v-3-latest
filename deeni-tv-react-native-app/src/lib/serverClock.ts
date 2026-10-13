/**
 * Device clock correction. The embedded schedule (the fallback when the API
 * doesn't answer) is computed from the clock, so a device that runs fast or
 * slow plays ahead of or behind the broadcast (the test TV box: ~12 s slow,
 * with automatic time on). Every HTTP reply carries the server's time in its
 * `Date` header, even a refusal, so each request measures the offset.
 * The header has 1 s resolution: offsets under 2 s are treated as noise.
 */
const NOISE_MS = 2000;
const MAX_RTT_MS = 5000;

let offsetMs = 0;

export function noteServerDate(dateHeader: string | null, sentAt: number, receivedAt: number): void {
  if (!dateHeader || receivedAt - sentAt > MAX_RTT_MS) return;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return;
  // The header is truncated to the second: its middle is the best estimate.
  const measured = server + 500 - (sentAt + receivedAt) / 2;
  offsetMs = Math.abs(measured) < NOISE_MS ? 0 : measured;
}

/** Now, by the servers' clock (equals Date.now() until a reply has been seen, or when the device is right). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}
