// Time-ordered UUIDs (RFC 9562 version 7): 48-bit Unix milliseconds, then a 12-bit counter, then
// random bits. Sorting the ids as strings sorts them by creation time; the counter keeps ids made
// within the same millisecond in creation order too.

let lastMs = -1;
let counter = 0;

function randomBytes(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** A new UUIDv7. Pass `ms` to create one for a given time (e.g. when importing old records). */
export function uuidv7(ms?: number): string {
  let t = ms ?? Date.now();
  if (ms === undefined && t < lastMs) t = lastMs; // clock went backwards: stay monotonic
  if (t === lastMs) {
    counter++;
    if (counter > 0xfff) { // 4096 ids in one millisecond: borrow the next millisecond
      t = lastMs + 1;
      counter = 0;
    }
  } else {
    counter = randomBytes(1)[0] & 0x7f; // start low so the counter has room to grow
  }
  lastMs = t;

  const bytes = randomBytes(16);
  bytes[0] = Math.floor(t / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(t / 2 ** 32) & 0xff;
  bytes[2] = (t >>> 24) & 0xff;
  bytes[3] = (t >>> 16) & 0xff;
  bytes[4] = (t >>> 8) & 0xff;
  bytes[5] = t & 0xff;
  bytes[6] = 0x70 | ((counter >>> 8) & 0x0f); // version 7 + counter high bits
  bytes[7] = counter & 0xff;
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // RFC 9562 variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The creation time (Unix ms) embedded in a UUIDv7. */
export function uuidv7Time(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
