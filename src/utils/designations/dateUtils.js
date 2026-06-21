/**
 * Date utilities for designation processing
 */

import { DateTime } from 'luxon';
import { defaultConfig } from './config.js';

/**
 * Create a Luxon DateTime in the configured timezone
 * @param {string|Date} dateInput - Date string or Date object
 * @param {string} timezone - Timezone to use (default from config)
 * @returns {DateTime} Luxon DateTime object
 */
export function createDateTime(dateInput, timezone = defaultConfig.timezone) {
  if (!dateInput) return null;

  // If it's already a Date object, convert to ISO string first
  const dateString = dateInput instanceof Date
    ? dateInput.toISOString().split('T')[0]
    : dateInput;

  // Parse the date string and set timezone
  return DateTime.fromISO(dateString, { zone: timezone });
}

/**
 * Get the difference in days between two dates
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @param {string} timezone - Timezone to use
 * @returns {number} Absolute difference in days
 */
export function getDaysDifference(date1, date2, timezone = defaultConfig.timezone) {
  const dt1 = createDateTime(date1, timezone);
  const dt2 = createDateTime(date2, timezone);
  return Math.abs(dt1.diff(dt2, 'days').days);
}
