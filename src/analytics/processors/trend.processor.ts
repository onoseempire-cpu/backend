export interface DataPoint { date: string; value: number; }

export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

export interface TrendResult {
  direction: TrendDirection;
  slope: number;
  movingAverage: Array<{ date: string; value: number; ma: number }>;
  average: number;
}

export class TrendProcessor {
  /**
   * Analyze a time-series and return trend direction + moving average
   */
  static analyze(data: Array<{ date: string; value: number }>): TrendResult {
    if (data.length < 2) return { direction: 'unknown', slope: 0, movingAverage: data.map(d => ({ date: d.date, value: d.value, ma: d.value })), average: data[0]?.value ?? 0 };

    const n = data.length;
    const values = data.map(d => d.value);
    const avg = values.reduce((s, v) => s + v, 0) / n;

    // Simple linear regression slope
    let sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumXY += i * (values[i] - avg);
      sumX2 += i * i;
    }
    const slope = sumX2 === 0 ? 0 : sumXY / sumX2;

    const direction: TrendDirection = slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'flat';

    // 7-day moving average
    const movingAverage = data.map((d, i) => {
      const start = Math.max(0, i - 7 + 1);
      const window = data.slice(start, i + 1).map(d => d.value);
      return { date: d.date, value: d.value, ma: window.reduce((s, v) => s + v, 0) / window.length };
    });

    return { direction, slope: Math.round(slope * 100) / 100, movingAverage, average: Math.round(avg) };
  }

  static detectAnomalies(data: Array<{ date: string; value: number }>, threshold = 2): Array<{ date: string; value: number }> {
    if (data.length < 3) return [];
    const values = data.map(d => d.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
    return data.filter(d => Math.abs(d.value - mean) > threshold * stdDev);
  }
}
