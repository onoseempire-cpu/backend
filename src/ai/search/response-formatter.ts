import type { ParsedQuery } from './query-parser';
import type { QueryResult } from './query-executor';
import type { AISearchResult } from '../../types/api';

const formatNumber = (n: number | null | undefined, unit = ''): string => {
  if (n === null || n === undefined) return 'N/A';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${unit}`.trim();
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K ${unit}`.trim();
  return `${n.toLocaleString()} ${unit}`.trim();
};

const buildNarrativeAnswer = (parsed: ParsedQuery, result: QueryResult): string => {
  if (!result.found) return result.disclaimer ?? 'No data available for this query.';

  const { period } = result;
  const periodLabel = `between ${period.startDate} and ${period.endDate}`;

  switch (parsed.intent) {
    case 'get_subscribers':
      return `You ${result.value !== null && result.value! >= 0 ? 'gained' : 'lost'} a net of **${formatNumber(result.value, 'subscribers')}** ${periodLabel}. This is based on your YouTube Analytics data.`;

    case 'get_views':
      if (result.comparisonData) {
        const { change, changePercent } = result.comparisonData;
        const dir = change >= 0 ? 'up' : 'down';
        return `Your channel received **${formatNumber(result.value, 'views')}** ${periodLabel}, which is ${dir} **${formatNumber(Math.abs(change))} views (${changePercent !== null ? `${changePercent}%` : 'N/A'})** compared to the previous period.`;
      }
      return `Your channel received **${formatNumber(result.value, 'views')}** ${periodLabel}.`;

    case 'get_watch_time':
      return `Your total watch time was **${formatNumber(result.value, 'hours')}** ${periodLabel}.`;

    case 'get_revenue':
      return `Your estimated revenue was **$${(result.value ?? 0).toFixed(2)}** ${periodLabel}. ${result.disclaimer ?? ''}`;

    case 'get_impressions':
      return `Your videos received **${formatNumber(result.value, 'impressions')}** ${periodLabel}.`;

    case 'get_ctr':
      return `Your average click-through rate (CTR) was **${result.value}%** ${periodLabel}.`;

    case 'get_likes':
      return `Your videos received **${formatNumber(result.value, 'likes')}** ${periodLabel}.`;

    case 'get_comments':
      return `Your videos received **${formatNumber(result.value, 'comments')}** ${periodLabel}.`;

    case 'get_shares':
      return `Your content was shared **${formatNumber(result.value, 'times')}** ${periodLabel}.`;

    case 'get_top_videos':
      return `Here are your top ${result.rows?.length ?? 0} videos ranked by views from your YouTube channel.`;

    case 'get_top_pages':
      return `Here are the top ${result.rows?.length ?? 0} pages from your website based on Google Analytics data.`;

    case 'get_traffic_sources':
      return `Here are the top traffic sources driving sessions to your website ${periodLabel}.`;

    case 'get_sessions':
      if (result.comparisonData) {
        const { change, changePercent } = result.comparisonData;
        const dir = change >= 0 ? 'increased' : 'decreased';
        return `Your website had **${formatNumber(result.value, 'sessions')}** ${periodLabel}. That ${dir} by **${formatNumber(Math.abs(change))} sessions (${changePercent !== null ? `${changePercent}%` : 'N/A'})** vs. the previous period.`;
      }
      return `Your website had **${formatNumber(result.value, 'sessions')}** ${periodLabel}.`;

    case 'get_users':
      return `Your website had **${formatNumber(result.value, 'active users')}** ${periodLabel}.`;

    case 'get_engagement':
      return `Here's an engagement summary across your connected platforms ${periodLabel}.`;

    case 'get_overview':
    default:
      return `Here's a performance overview across all your connected accounts ${periodLabel}.`;
  }
};

const buildResultData = (parsed: ParsedQuery, result: QueryResult): AISearchResult['data'] => {
  if (result.rows && result.rows.length > 0) {
    const columns = Object.keys(result.rows[0]);
    return { type: 'table', rows: result.rows, columns };
  }
  if (result.comparisonData) {
    return {
      type: 'comparison',
      comparisonData: [
        { period: result.comparisonData.currentPeriod, value: result.comparisonData.current, change: result.comparisonData.change, changePercent: result.comparisonData.changePercent ?? 0 },
        { period: result.comparisonData.previousPeriod, value: result.comparisonData.previous, change: 0, changePercent: 0 },
      ],
    };
  }
  if (result.chartData && result.chartData.length > 0) {
    return {
      type: 'chart',
      chartData: result.chartData.map(d => ({ label: d.date, value: d.value })),
    };
  }
  return { type: 'number', value: result.value ?? 0, unit: result.unit };
};

export const formatResponse = (
  parsed: ParsedQuery,
  result: QueryResult
): AISearchResult => {
  return {
    question: parsed.originalQuery,
    answer: buildNarrativeAnswer(parsed, result),
    confidence: result.found ? parsed.confidence : 'unavailable',
    source: result.source,
    reportingPeriod: result.period.startDate && result.period.endDate
      ? `${result.period.startDate} to ${result.period.endDate}`
      : 'N/A',
    data: buildResultData(parsed, result),
    disclaimer: result.disclaimer ?? (result.found && result.source.includes('YouTube')
      ? 'Google Analytics data may be delayed by up to 48 hours.'
      : null),
  };
};
