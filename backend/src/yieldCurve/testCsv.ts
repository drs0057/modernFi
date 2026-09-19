// Shared CSV fixtures for the Treasury parsing and refresh tests.
export const HEADER_ROW =
  'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"';

export function csvRow(mmddyyyy: string, oneYear = '4.40') {
  return `${mmddyyyy},3.97,3.98,4.09,4.12,4.23,4.20,${oneYear},4.67,4.75,4.78,4.86,4.94,5.32,5.29`;
}
