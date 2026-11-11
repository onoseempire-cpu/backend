/** Calculates growth rates and change deltas between two values */
export class GrowthProcessor {
  static percentageChange(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  static absoluteChange(current: number, previous: number): number {
    return current - previous;
  }

  static categorize(growthPct: number | null): 'up' | 'down' | 'flat' | 'unknown' {
    if (growthPct === null) return 'unknown';
    if (growthPct > 1) return 'up';
    if (growthPct < -1) return 'down';
    return 'flat';
  }

  static buildComparison(
    label: string,
    current: number,
    previous: number,
    unit = ''
  ) {
    const change = this.absoluteChange(current, previous);
    const pct = this.percentageChange(current, previous);
    return {
      label, current, previous, change, changePercent: pct,
      trend: this.categorize(pct), unit,
    };
  }
}
