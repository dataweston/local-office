export function assertBeforeCutoff(cutoffAt: Date, now: Date = new Date()): void {
  if (cutoffAt.getTime() <= now.getTime()) {
    throw new Error('ORDER_AFTER_CUTOFF');
  }
}

export function hoursUntilCutoff(cutoffAt: Date, now: Date = new Date()): number {
  const diffMs = cutoffAt.getTime() - now.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}
