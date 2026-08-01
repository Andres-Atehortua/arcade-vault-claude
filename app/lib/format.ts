/**
 * Formats a Postgres timestamptz as DD/MM/YYYY.
 *
 * Always reads the date in UTC, never in the local timezone: the result is
 * computed on the server and shipped to the browser, so a locale-dependent
 * format would produce a different string after hydration.
 */
export const formatScoreDate = (iso: string): string => {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${day}/${month}/${date.getUTCFullYear()}`;
};
