const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sendEmail } = require('../actionHandlers/email');
const { scheduleEvent } = require('../actionHandlers/scheduler');

// POST /api/agent/execute
router.post('/execute', async (req, res) => {
  const { action, userId, query, emotion, history, sessionId, email } = req.body || {};
  
  if (!action || !userId || !query) {
    return res.status(400).json({ error: 'action, userId, and query required' });
  }

  try {
    let result = {};
    
    switch (action) {
      case 'question':
        // Route to Python RAG service
        const pythonRagUrl = process.env.PYTHON_RAG_URL || 'http://localhost:8000/query-rag';
        const ragResponse = await axios.post(pythonRagUrl, { 
          userId, 
          query, 
          emotion: emotion || 'neutral', 
          history: history || [] 
        }, { timeout: 1000 * 60 });
        
        result = {
          action: 'question',
          answer: ragResponse.data?.answer || '',
          sources: ragResponse.data?.sources || [],
          confidence: ragResponse.data?.confidence || null,
          documentContent: extractDocumentContent(ragResponse.data?.sources || [])
        };
        break;
        
      case 'summarize':
        // Route to Python RAG with summarize instruction and get full document content
        const summarizeUrl = process.env.PYTHON_RAG_URL || 'http://localhost:8000/query-rag';
        const summarizeResponse = await axios.post(summarizeUrl, { 
          userId, 
          query: `Please provide a comprehensive summary of the document(s) based on the content: ${query}`, 
          emotion: emotion || 'neutral', 
          history: history || [] 
        }, { timeout: 1000 * 60 });
        
        const documentSummary = summarizeResponse.data?.answer || '';
        const documentSources = summarizeResponse.data?.sources || [];
        
        result = {
          action: 'summarize',
          answer: documentSummary,
          sources: documentSources,
          confidence: summarizeResponse.data?.confidence || null,
          documentContent: extractFullDocumentContent(documentSources),
          documentSummary: documentSummary // Explicit document summary
        };
        break;
        
      case 'email':
        // Get document content first, then generate and send email
        let emailContent = '';
        let docSummary = '';
        let docContent = '';
        
        try {
          // First get document summary
          const emailRagUrl = process.env.PYTHON_RAG_URL || 'http://localhost:8000/query-rag';
          const emailRagResponse = await axios.post(emailRagUrl, { 
            userId, 
            query: `Extract and summarize the main content of the document(s) related to: ${query}`, 
            emotion: emotion || 'neutral', 
            history: history || [] 
          }, { timeout: 1000 * 60 });
          
          docSummary = emailRagResponse?.data?.answer || '';
          const documentSources = emailRagResponse?.data?.sources || [];
          docContent = extractFullDocumentContent(documentSources);
          
          // Generate email content
          if (docSummary && docSummary !== 'The document does not contain this information.') {
            emailContent = generateEmailContent(query, docSummary, docContent);
          } else {
            emailContent = generateNoContentEmail(query);
          }
          
          // Check if user wants PDF attachment
          const wantsPDFAttachment = /pdf|attachment|export|download/i.test(query);
          
          // Actually send the email
          const emailResult = await sendEmail({
            email: email || userId, // Use provided email or fallback to userId
            subject: generateEmailSubject(query),
            content: emailContent,
            query: query,
            includePDF: wantsPDFAttachment,
            chatHistory: history || [],
            wantsSummary: true,
            wantsPDF: wantsPDFAttachment,
            wantsAnswer: true
          }, userId);
          
          console.log('[AGENT] Email sent successfully:', emailResult);
          
        } catch (e) {
          console.log('Failed to get document content for email:', e.message);
          emailContent = generateNoContentEmail(query);
          
          // Still try to send the "no content" email
          try {
            const wantsPDFAttachment = /pdf|attachment|export|download/i.test(query);
            const emailResult = await sendEmail({
              email: email || userId,
              subject: generateEmailSubject(query),
              content: emailContent,
              query: query,
              includePDF: wantsPDFAttachment,
              chatHistory: history || [],
              wantsSummary: false,
              wantsPDF: wantsPDFAttachment,
              wantsAnswer: false
            }, userId);
            console.log('[AGENT] "No content" email sent:', emailResult);
          } catch (emailError) {
            console.log('[AGENT] Failed to send email:', emailError.message);
          }
        }
        
        result = {
          action: 'email',
          answer: emailContent,
          sources: [],
          confidence: null,
          emailData: {
            to: userId,
            subject: generateEmailSubject(query),
            body: emailContent,
            hasDocumentContent: !!docSummary,
            documentSummary: docSummary,
            documentContent: docContent,
            status: 'Email processing initiated'
          }
        };
        break;
        
      case 'schedule':
        // Extract date and time from the query
        const dateMatch = query.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*(\d{4})?/i);
        // Extract time - improved pattern to handle "11.30AM"
        const timeMatch = query.match(/(\d{1,2})[:\.]?(\d{2})?\s*(am|pm)/i);
        
        let extractedDate = 'tomorrow';
        let extractedTime = '9:00 AM';
        
        // Extract date
        if (dateMatch) {
          const day = dateMatch[1];
          const month = dateMatch[2];
          const year = dateMatch[3] || new Date().getFullYear();
          
          // Convert month name to number
          const monthMap = {
            'january': 0, 'jan': 0,
            'february': 1, 'feb': 1,
            'march': 2, 'mar': 2,
            'april': 3, 'apr': 3,
            'may': 4,
            'june': 5, 'jun': 5,
            'july': 6, 'jul': 6,
            'august': 7, 'aug': 7,
            'september': 8, 'sep': 8,
            'october': 9, 'oct': 9,
            'november': 10, 'nov': 10,
            'december': 11, 'dec': 11
          };
          
          const monthNum = monthMap[month.toLowerCase()];
          if (monthNum !== undefined) {
            extractedDate = `${monthNum + 1}/${day}/${year}`;
            console.log('[AGENT] Extracted date:', extractedDate);
          }
        }
        
        // Extract time
        console.log('[AGENT] Time extraction - query:', query);
        console.log('[AGENT] Time match result:', timeMatch);
        
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
          
          console.log('[AGENT] Time components:', { hours, minutes, period });
          
          // Handle AM/PM
          if (period === 'pm' && hours < 12) {
            hours += 12;
          } else if (period === 'am' && hours === 12) {
            hours = 0;
          }
          
          // Convert to 12-hour format with AM/PM
          const displayHours = hours % 12 || 12;
          const displayPeriod = hours >= 12 ? 'PM' : 'AM';
          
          extractedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${displayPeriod}`;
          console.log('[AGENT] Extracted time:', extractedTime);
        } else {
          console.log('[AGENT] No time match found, using default 9:00 AM');
        }
        
        console.log('[AGENT] Scheduling with:', { date: extractedDate, time: extractedTime, query });
        
        const scheduleResult = await scheduleEvent({
          query: query,
          description: query, // Use the full query as description
          date: extractedDate,
          time: extractedTime
        }, userId);
        
        result = {
          action: 'schedule',
          answer: scheduleResult.message || 'Event scheduled successfully',
          sources: [],
          confidence: null,
          scheduleData: scheduleResult.data
        };
        break;
        
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    
    return res.json(result);
  } catch (err) {
    console.error('agent.execute error', err && err.message ? err.message : err);
    const status = err && err.response && err.response.status ? err.response.status : 500;
    const messageErr = err && err.response && err.response.data ? err.response.data : 'failed_to_execute_action';
    return res.status(status).json({ error: messageErr });
  }
});

// Helper function to extract document content from sources
function extractDocumentContent(sources) {
  if (!sources || sources.length === 0) return '';
  
  return sources.map(source => {
    return `Document: ${source.docName || 'Unknown'}\nPage: ${source.pageNumber || 'N/A'}\nContent: ${source.snippet || source.text || ''}\n---`;
  }).join('\n');
}

// Helper function to extract full document content for emails
function extractFullDocumentContent(sources) {
  if (!sources || sources.length === 0) return '';
  
  return sources.map((source, index) => {
    return `[${index + 1}] ${source.docName || 'Unknown Document'} (Page ${source.pageNumber || 'N/A'})\n${source.snippet || source.text || 'No content available'}\n`;
  }).join('\n\n');
}

// Helper function to generate email content
function generateEmailContent(query, documentSummary, documentContent) {
  return `Document Query: ${query}

Document Summary:
${documentSummary}

---
Document Details:
${documentContent}

---
This email was generated by the Document AI Assistant based on your query.`;
}

// Helper function to generate email when no document content is found
function generateNoContentEmail(query) {
  return `Document Query: ${query}

Status: No relevant document content found for your query.

The system searched through available documents but could not find specific information related to your request. Please try:
- Using different keywords
- Checking if the documents are uploaded and processed
- Providing more specific search terms

---
This email was generated by the Document AI Assistant.`;
}

// Helper function to generate email subject
function generateEmailSubject(query) {
  const cleanQuery = query.substring(0, 50).replace(/[^\w\s]/gi, '');
  return `Document Query: ${cleanQuery}${query.length > 50 ? '...' : ''}`;
}

// GET /api/agent/actions
router.get('/actions', (req, res) => {
  return res.json({
    actions: [
      {
        name: 'question',
        description: 'Answer questions using RAG',
        parameters: ['userId', 'query', 'emotion', 'history']
      },
      {
        name: 'summarize', 
        description: 'Summarize content from documents',
        parameters: ['userId', 'query', 'emotion', 'history']
      },
      {
        name: 'email',
        description: 'Generate email with document content',
        parameters: ['userId', 'query', 'emotion', 'history', 'email']
      },
      {
        name: 'schedule',
        description: 'Schedule events and reminders',
        parameters: ['userId', 'query', 'emotion', 'history']
      }
    ]
  });
});

module.exports = router;
