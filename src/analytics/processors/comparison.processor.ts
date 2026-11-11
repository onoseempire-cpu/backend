import { GrowthProcessor } from './growth.processor';

export class ComparisonProcessor {
  static compareMetrics(
    current: Record<string, number>,
    previous: Record<string, number>,
    keys: string[],
    units: Record<string, string> = {}
  ) {
    return keys.map(key => GrowthProcessor.buildComparison(
      key,
      current[key] ?? 0,
      previous[key] ?? 0,
      units[key] ?? ''
    ));
  }

  static rankItems<T extends Record<string, unknown>>(
    items: T[],
    sortKey: keyof T,
    limit = 10,
    desc = true
  ): (T & { rank: number })[] {
    return [...items]
      .sort((a, b) => {
        const av = (a[sortKey] as number) ?? 0;
        const bv = (b[sortKey] as number) ?? 0;
        return desc ? bv - av : av - bv;
      })
      .slice(0, limit)
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }

  static buildPeriodComparison(
    periodA: { label: string; data: Record<string, number> },
    periodB: { label: string; data: Record<string, number> },
    keys: string[]
  ) {
    return {
      periods: [periodA.label, periodB.label],
      comparisons: keys.map(key => ({
        metric: key,
        [periodA.label]: periodA.data[key] ?? 0,
        [periodB.label]: periodB.data[key] ?? 0,
        change: (periodA.data[key] ?? 0) - (periodB.data[key] ?? 0),
        changePercent: GrowthProcessor.percentageChange(periodA.data[key] ?? 0, periodB.data[key] ?? 0),
      })),
    };
  }
}
