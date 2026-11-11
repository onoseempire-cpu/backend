// YouTube data normalizer — converts raw API objects into IndexedRecord format
export class YouTubeNormalizer {
  static normalizeChannel(channel: Record<string, unknown>, userId: string) {
    return {
      userId,
      source: 'youtube',
      recordType: 'channel',
      externalId: channel.channelId as string,
      dataJson: JSON.stringify(channel),
    };
  }

  static normalizeVideo(video: Record<string, unknown>, userId: string) {
    return {
      userId,
      source: 'youtube',
      recordType: 'video',
      externalId: video.videoId as string,
      dataJson: JSON.stringify(video),
    };
  }

  static normalizeMetric(metric: Record<string, unknown>, channelId: string, userId: string) {
    return {
      userId,
      source: 'youtube',
      recordType: 'channel_metric',
      externalId: `${channelId}_${metric.date}`,
      dataJson: JSON.stringify(metric),
    };
  }
}
