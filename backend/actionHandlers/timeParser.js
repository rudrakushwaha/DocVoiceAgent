/**
 * Advanced Time Parser for Scheduler
 * Uses multiple parsing strategies for better accuracy
 */

/**
 * Parse time from text using multiple methods
 */
function parseTimeFromText(text) {
  console.log('[TIME_PARSER] Parsing time from:', text);
  
  // Method 1: Direct regex patterns - order matters!
  const timePatterns = [
    // 3:30 PM, 2:30am, 14:00 (most specific first)
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    // 3 PM, 2 am, 5pm (medium specificity)
    /(\d{1,2})\s*(am|pm)/i,
    // 3:30, 14:00 (24-hour with minutes)
    /(\d{1,2}):(\d{2})/i,
    // 3, 5, 14 (single hour - least specific)
    /(\d{1,2})/i
  ];
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      console.log('[TIME_PARSER] Pattern matched:', pattern, 'Match:', match);
      
      let hours = parseInt(match[1]);
      let minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3] ? match[3].toLowerCase() : (match[2] ? match[2].toLowerCase() : null);
      
      // Handle case where pattern doesn't capture minutes (like "5PM")
      if (isNaN(minutes)) {
        minutes = 0;
      }
      
      console.log('[TIME_PARSER] Time components before processing:', { hours, minutes, period, match });
      
      // Handle AM/PM conversion
      if (period === 'pm' && hours < 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }
      
      // Handle 24-hour format
      if (hours > 23) {
        hours = 12; // Default to noon if invalid
      }
      
      if (minutes > 59) {
        minutes = 0; // Default to top of hour if invalid
      }
      
      const result = {
        hours,
        minutes,
        period: period || (hours >= 12 ? 'pm' : 'am'),
        formatted: `${hours}:${minutes.toString().padStart(2, '0')}`,
        display: `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
      };
      
      console.log('[TIME_PARSER] Parsed time:', result);
      return result;
    }
  }
  
  console.log('[TIME_PARSER] No time pattern found');
  return null;
}

/**
 * Parse date from text
 */
function parseDateFromText(text) {
  console.log('[TIME_PARSER] Parsing date from:', text);
  
  const datePatterns = [
    // today, tomorrow, next week
    /(today|tomorrow|next week)/i,
    // MM/DD, MM-DD
    /(\d{1,2})[\/\-](\d{1,2})/i,
    // March 15, Apr 30
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      console.log('[TIME_PARSER] Date pattern matched:', pattern, 'Match:', match);
      return match[0];
    }
  }
  
  console.log('[TIME_PARSER] No date pattern found, defaulting to tomorrow');
  return 'tomorrow';
}

/**
 * Create datetime object from date and time
 */
function createDateTime(dateStr, timeStr) {
  console.log('[TIME_PARSER] Creating datetime from:', { dateStr, timeStr });
  
  const now = new Date();
  let targetDate = new Date();
  
  // Parse date
  const dateText = parseDateFromText(dateStr);
  const lowerDate = dateText.toLowerCase();
  
  if (lowerDate === 'today') {
    targetDate = now;
  } else if (lowerDate === 'tomorrow') {
    targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (lowerDate === 'next week') {
    targetDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    // Try to parse specific date
    const dateMatch = dateText.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]) - 1;
      const day = parseInt(dateMatch[2]);
      targetDate = new Date(now.getFullYear(), month, day);
      
      if (targetDate < now) {
        targetDate.setFullYear(now.getFullYear() + 1);
      }
    }
  }
  
  // Parse time
  const timeInfo = parseTimeFromText(timeStr);
  if (timeInfo) {
    targetDate.setHours(timeInfo.hours, timeInfo.minutes, 0, 0);
    console.log('[TIME_PARSER] Set time to:', timeInfo.display);
  } else {
    console.log('[TIME_PARSER] No time found, using 9:00 AM');
    targetDate.setHours(9, 0, 0, 0);
  }
  
  console.log('[TIME_PARSER] Final datetime:', targetDate.toString());
  console.log('[TIME_PARSER] UTC datetime:', targetDate.toISOString());
  
  return targetDate;
}

module.exports = {
  parseTimeFromText,
  parseDateFromText,
  createDateTime
};
