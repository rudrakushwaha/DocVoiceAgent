const axios = require('axios');
const { createDateTime } = require('./timeParser');

/**
 * Scheduler Action Handler
 * Schedules events via n8n webhook
 */

async function scheduleEvent(params, userId) {
  try {
    console.log('[SCHEDULER] Scheduling event:', { 
      time: params.time, 
      date: params.date, 
      userId 
    });
    
    const { time, date, description, query } = params;
    
    if (!description && !query) {
      throw new Error('Event description or original query is required');
    }
    
    // Use new time parser
    const eventDateTime = createDateTime(date || 'tomorrow', time || '9:00 AM');
    
    // Validate that the event is in the future
    const now = new Date();
    if (eventDateTime <= now) {
      throw new Error('Event time must be in the future');
    }
    
    // Get n8n webhook URL from environment
    const webhookUrl = process.env.N8N_SCHEDULER_WEBHOOK_URL;
    
    // Check if webhook URL is set and valid
    if (!webhookUrl || webhookUrl.includes('your-n8n.com')) {
      console.log('[SCHEDULER] No valid webhook URL configured, simulating event scheduling');
      // Simulate event scheduling for development
      return {
        status: 'success',
        message: `Event would be scheduled for ${eventDateTime.toLocaleString()}`,
        data: {
          eventTime: eventDateTime.toISOString(),
          description: description || query,
          userId: userId,
          simulated: true
        }
      };
    }
    
    // Prepare payload for n8n
    const payload = {
      eventTime: eventDateTime.toISOString(),
      description: description || `Reminder: ${query}`,
      userId: userId,
      originalQuery: query,
      timestamp: new Date().toISOString(),
      // Additional fields for n8n workflow
      title: 'DocAI Reminder',
      type: 'reminder',
      priority: 'normal'
    };
    
    console.log('[SCHEDULER] Calling n8n webhook:', webhookUrl);
    console.log('[SCHEDULER] Event payload:', {
      eventTime: payload.eventTime,
      description: payload.description
    });
    
    // Call n8n webhook
    const response = await axios.post(webhookUrl, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('[SCHEDULER] n8n response:', response.status);
    
    return {
      status: 'success',
      message: `Event scheduled successfully for ${eventDateTime.toLocaleString()}`,
      data: {
        eventTime: eventDateTime.toISOString(),
        eventTimeFormatted: eventDateTime.toLocaleString(),
        description: payload.description,
        userId: userId,
        webhookStatus: response.status,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('[SCHEDULER] Error scheduling event:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Scheduler service timeout - please try again');
    }
    
    if (error.response) {
      console.error('[SCHEDULER] n8n error response:', error.response.status, error.response.data);
      throw new Error(`Scheduler service error: ${error.response.status}`);
    }
    
    throw new Error(`Failed to schedule event: ${error.message}`);
  }
}

module.exports = {
  scheduleEvent
};
