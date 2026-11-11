import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export class YouTubeDataService {
  static async syncChannelInfo(connectedAccountId: string): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const youtube = google.youtube({ version: 'v3', auth });
    const { data } = await youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      mine: true, maxResults: 50,
    });
    for (const ch of data.items ?? []) {
      if (!ch.id) continue;
      await prisma.youTubeChannel.upsert({
        where: { channelId: ch.id },
        create: {
          connectedAccountId, channelId: ch.id,
          title: ch.snippet?.title ?? 'Untitled',
          description: ch.snippet?.description ?? null,
          customUrl: ch.snippet?.customUrl ?? null,
          thumbnailUrl: ch.snippet?.thumbnails?.high?.url ?? null,
          country: ch.snippet?.country ?? null,
          language: ch.snippet?.defaultLanguage ?? null,
          subscriberCount: parseInt(ch.statistics?.subscriberCount ?? '0') || null,
          subscriberHidden: ch.statistics?.hiddenSubscriberCount ?? false,
          viewCount: parseInt(ch.statistics?.viewCount ?? '0') || null,
          videoCount: parseInt(ch.statistics?.videoCount ?? '0') || null,
          publishedAt: ch.snippet?.publishedAt ? new Date(ch.snippet.publishedAt) : null,
          lastFetchedAt: new Date(),
        },
        update: {
          title: ch.snippet?.title ?? undefined,
          subscriberCount: parseInt(ch.statistics?.subscriberCount ?? '0') || null,
          viewCount: parseInt(ch.statistics?.viewCount ?? '0') || null,
          videoCount: parseInt(ch.statistics?.videoCount ?? '0') || null,
          lastFetchedAt: new Date(),
        },
      });
    }
    logger.info('Channel info synced', { connectedAccountId });
  }

  static async syncVideos(connectedAccountId: string, maxVideos = 500): Promise<number> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const youtube = google.youtube({ version: 'v3', auth });
    const channels = await prisma.youTubeChannel.findMany({ where: { connectedAccountId } });
    let total = 0;

    for (const channel of channels) {
      let pageToken: string | undefined;
      let fetched = 0;
      do {
        const search = await youtube.search.list({
          part: ['id'], channelId: channel.channelId,
          type: ['video'], order: 'date', maxResults: 50, pageToken,
        });
        const ids = (search.data.items ?? []).map(i => i.id?.videoId).filter(Boolean) as string[];
        if (!ids.length) break;

        const details = await youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails', 'status'], id: ids,
        });
        for (const v of details.data.items ?? []) {
          if (!v.id) continue;
          await prisma.youTubeVideo.upsert({
            where: { videoId: v.id },
            create: {
              channelId: channel.channelId, videoId: v.id,
              title: v.snippet?.title ?? 'Untitled',
              description: v.snippet?.description?.slice(0, 5000) ?? null,
              thumbnailUrl: v.snippet?.thumbnails?.high?.url ?? null,
              publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
              duration: v.contentDetails?.duration ?? null,
              privacyStatus: v.status?.privacyStatus ?? null,
              viewCount: parseInt(v.statistics?.viewCount ?? '0') || null,
              likeCount: parseInt(v.statistics?.likeCount ?? '0') || null,
              commentCount: parseInt(v.statistics?.commentCount ?? '0') || null,
              favoriteCount: parseInt(v.statistics?.favoriteCount ?? '0') || null,
              tags: v.snippet?.tags ? JSON.stringify(v.snippet.tags) : null,
              categoryId: v.snippet?.categoryId ?? null,
              defaultLanguage: v.snippet?.defaultLanguage ?? null,
              lastFetchedAt: new Date(),
            },
            update: {
              title: v.snippet?.title ?? undefined,
              viewCount: parseInt(v.statistics?.viewCount ?? '0') || null,
              likeCount: parseInt(v.statistics?.likeCount ?? '0') || null,
              commentCount: parseInt(v.statistics?.commentCount ?? '0') || null,
              lastFetchedAt: new Date(),
            },
          });
          fetched++; total++;
        }
        pageToken = search.data.nextPageToken ?? undefined;
      } while (pageToken && fetched < maxVideos);
      logger.info(`Synced ${fetched} videos for channel ${channel.title}`);
    }
    return total;
  }
}
