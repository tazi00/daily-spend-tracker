/**
 * Server-side date/timezone helpers.
 *
 * The server owns the calendar: "today" is computed here in the configured
 * timezone, never from the browser.
 *
 * Standard two-pass trick for wall-clock ↔ epoch conversion in a zone:
 *   1. Guess an epoch as if the wall clock were UTC.
 *   2. Ask the zone what the wall clock is at that guess.
 *   3. The difference is the zone offset at that instant; subtract it.
 *   4. Re-check once (DST can shift the offset between passes); using the
 *      offset from the *final* pass handles every case, including the DST
 *      gap where the requested wall time does not literally exist.
 */
import { config } from "./config.js";

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: config.timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Current date in the app timezone as "YYYY-MM-DD". */
export function todayKey() {
  return keyFormatter.format(new Date());
}

/** Wall-clock "YYYY-MM-DD" in the app timezone for an epoch. */
export function dateKeyFor(epochMs) {
  return keyFormatter.format(new Date(epochMs));
}

/** Wall-clock "HH:MM" in the app timezone for an epoch. */
export function timeInZone(epochMs) {
  return timeFormatter.format(new Date(epochMs));
}

/**
 * Epoch millis for a "YYYY-MM-DD" + "HH:MM" pair interpreted as the wall
 * clock in the app timezone.
 */
export function epochFor(dateKey, hhmm = "12:00") {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);

  const offset = (guess) => {
    // Offset at `guess` = (wall clock at that instant, read as UTC) - instant.
    const wallKey = keyFormatter.format(new Date(guess));
    const [wy, wm, wd] = wallKey.split("-").map(Number);
    const wallTime = timeFormatter.format(new Date(guess));
    const [wh, wm2] = wallTime.split(":").map(Number);
    return Date.UTC(wy, wm - 1, wd, wh, wm2) - guess;
  };

  // Two passes: the second uses the offset observed at the first guess.
  const firstGuess = asUtc;
  return asUtc - offset(firstGuess - offset(firstGuess));
}

/**
 * Normalize a client timestamp into the app timezone: derive its wall-clock
 * date + time in the app zone, then recompute a clean epoch for that wall
 * time. Guarantees occurredAt always falls inside its own dateKey's day.
 */
export function normalizeOccurredAt(epochMs) {
  const dateKey = dateKeyFor(epochMs);
  const time = timeInZone(epochMs);
  return epochFor(dateKey, time);
}
