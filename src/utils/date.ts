/**
 * Date utility functions for analytics processing
 */

export const formatDate = (date: Date): string =>
  date.toISOString().split('T')[0]; // YYYY-MM-DD

export const parseDate = (dateStr: string): Date => new Date(dateStr + 'T00:00:00Z');

export const getDateRange = (
  period: 'today' | '7d' | '28d' | '30d' | '90d' | '365d' | 'this_month' | 'last_month' | 'this_year'
): { startDate: string; endDate: string } => {
  const now = new Date();
  const end = formatDate(now);

  switch (period) {
    case 'today':
      return { startDate: end, endDate: end };
    case '7d':
      return { startDate: formatDate(subtractDays(now, 7)), endDate: end };
    case '28d':
      return { startDate: formatDate(subtractDays(now, 28)), endDate: end };
    case '30d':
      return { startDate: formatDate(subtractDays(now, 30)), endDate: end };
    case '90d':
      return { startDate: formatDate(subtractDays(now, 90)), endDate: end };
    case '365d':
      return { startDate: formatDate(subtractDays(now, 365)), endDate: end };
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDate(start), endDate: end };
    }
    case 'last_month': {
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { startDate: formatDate(lastMonthStart), endDate: formatDate(lastMonthEnd) };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatDate(start), endDate: end };
    }
    default:
      return { startDate: formatDate(subtractDays(now, 30)), endDate: end };
  }
};

export const subtractDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

export const getDaysBetween = (start: string, end: string): number => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
};

export const getYesterdayDate = (): string =>
  formatDate(subtractDays(new Date(), 1));

export const getPreviousPeriod = (
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } => {
  const days = getDaysBetween(startDate, endDate) + 1;
  const start = parseDate(startDate);
  const prevEnd = subtractDays(start, 1);
  const prevStart = subtractDays(prevEnd, days - 1);
  return { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) };
};

export const generateDateArray = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const current = parseDate(startDate);
  const end = parseDate(endDate);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const toISODateString = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDate(d);
};
