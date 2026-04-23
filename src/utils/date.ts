export function formatLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date = new Date()) {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');

  return `${formatLocalDateKey(date)}T${hours}:${minutes}:${seconds}`;
}

export function getLocalDateKeyFromStoredValue(value: string) {
  const parsedDate = new Date(value);

  if (!Number.isNaN(parsedDate.getTime())) {
    return formatLocalDateKey(parsedDate);
  }

  const fallbackMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return fallbackMatch?.[1] ?? '';
}
