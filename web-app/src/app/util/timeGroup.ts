export type TimeGrouping = '1min' | '5min' | '15min' | '30min' | '1hour';

export function getTimeGroupKey(date: Date, timeGrouping: TimeGrouping) {
  const minutes = date.getMinutes();
  switch (timeGrouping) {
    case '1min':
      return `${date.toDateString()} ${date.getHours()}:${minutes.toString().padStart(2, '0')}`;
    case '5min':
      return `${date.toDateString()} ${date.getHours()}:${(Math.floor(minutes / 5) * 5).toString().padStart(2, '0')}`;
    case '15min':
      return `${date.toDateString()} ${date.getHours()}:${(Math.floor(minutes / 15) * 15).toString().padStart(2, '0')}`;
    case '30min':
      return `${date.toDateString()} ${date.getHours()}:${Math.floor(minutes / 30) * 30}`;
    case '1hour':
      return `${date.toDateString()} ${date.getHours()}:00`;
    default:
      return date.toDateString();
  }
}
