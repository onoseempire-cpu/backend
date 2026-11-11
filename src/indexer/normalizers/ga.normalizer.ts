// Google Analytics normalizer — converts raw GA4 API data into IndexedRecord format
export class GoogleAnalyticsNormalizer {
  static normalizeProperty(property: Record<string, unknown>, userId: string) {
    return {
      userId,
      source: 'google-analytics',
      recordType: 'property',
      externalId: property.propertyId as string,
      dataJson: JSON.stringify(property),
    };
  }

  static normalizeMetric(metric: Record<string, unknown>, propertyId: string, userId: string) {
    return {
      userId,
      source: 'google-analytics',
      recordType: 'daily_metric',
      externalId: `${propertyId}_${metric.date}`,
      dataJson: JSON.stringify(metric),
    };
  }
}
