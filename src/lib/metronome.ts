/**
 * Metronome timing.
 *
 * The scheduling is pure and separated from audio so it can be tested without
 * a sound card. A timer alone is not good enough for a metronome: setInterval
 * drifts by milliseconds every tick and the wander is audible within a bar.
 * Instead a coarse timer wakes up periodically and schedules every beat that
 * falls inside a short lookahead window at an exact AudioContext time.
 */

export const MIN_BPM = 30;
export const MAX_BPM = 260;
export const BEATS_PER_BAR = 4;

/** How far ahead beats are scheduled, in seconds. */
export const SCHEDULE_AHEAD = 0.12;
/** How often the scheduler wakes, in milliseconds. Well under the lookahead. */
export const SCHEDULER_INTERVAL_MS = 25;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function secondsPerBeat(bpm: number): number {
  return 60 / clampBpm(bpm);
}

/** Beat 1 of the bar is accented. */
export function isAccent(beat: number, beatsPerBar: number = BEATS_PER_BAR): boolean {
  return beat % beatsPerBar === 0;
}

export interface ScheduledBeat {
  /** Zero-based position in the bar. */
  beat: number;
  /** AudioContext time at which it sounds. */
  time: number;
  accent: boolean;
}

export interface SchedulerState {
  /** When the next beat is due. */
  nextBeatTime: number;
  /** Which beat of the bar that is. */
  nextBeat: number;
}

export interface AdvanceResult {
  beats: ScheduledBeat[];
  state: SchedulerState;
}

/**
 * Collect every beat due before `until`, and report where the scheduler got
 * to. Tempo is read per beat, so changing it mid-bar takes effect on the next
 * beat rather than retiming the ones already scheduled.
 */
export function advance(
  state: SchedulerState,
  until: number,
  bpm: number,
  beatsPerBar: number = BEATS_PER_BAR,
): AdvanceResult {
  const beats: ScheduledBeat[] = [];
  let { nextBeatTime, nextBeat } = state;

  // Guard against a pathological loop if a tab was suspended for a long time.
  const limit = 1000;

  while (nextBeatTime < until && beats.length < limit) {
    beats.push({
      beat: nextBeat,
      time: nextBeatTime,
      accent: isAccent(nextBeat, beatsPerBar),
    });

    nextBeatTime += secondsPerBeat(bpm);
    nextBeat = (nextBeat + 1) % beatsPerBar;
  }

  return { beats, state: { nextBeatTime, nextBeat } };
}
