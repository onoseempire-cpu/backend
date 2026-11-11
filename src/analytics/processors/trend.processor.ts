export interface DataPoint { date: string; value: number; }

export class TrendProcessor {
  /**
   * Analyze a time-series and return trend direction + moving average
   */
  static analyze(data: DataPoint[]) {
    if (data.length < 2) return { direction: 'unknown', slope: 0, movingAverage: data };

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

    const direction = slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'flat';

    // 7-day moving average
    const windowSize = Math.min(7, n);
    const movingAverage = data.map((d, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      return { date: d.date, value: d.value, ma: window.reduce((s, v) => s + v, 0) / window.length };
    });

    return { direction, slope: Math.round(slope * 100) / 100, movingAverage, average: Math.round(avg) };
  }

  static detectAnomalies(data: DataPoint[], threshold = 2): DataPoint[] {
    if (data.length < 3) return [];
    const values = data.map(d => d.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
    return data.filter(d => Math.abs(d.value - mean) > threshold * stdDev);
  }
}
