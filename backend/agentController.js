const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Import authentication middleware
const auth = require('./middleware/authMiddleware');

// Import action handlers
const emailHandler = require('./actionHandlers/email');
const pdfHandler = require('./actionHandlers/pdf');
const schedulerHandler = require('./actionHandlers/scheduler');

// Apply authentication middleware to all routes
router.use(auth);

// Enhanced intent detection using both query and RAG response
function detectIntent(query, ragResponse) {
  const lowerQuery = query.toLowerCase();
  const lowerRag = ragResponse ? ragResponse.toLowerCase() : '';
  const combinedText = `${lowerQuery} ${lowerRag}`;
  
  console.log('[AGENT] Detecting intent from query:', lowerQuery);
  console.log('[AGENT] RAG response:', lowerRag.substring(0, 100) + '...');
  
  // Check for PDF patterns first
  const hasPdf = lowerQuery.includes('pdf') || 
    lowerQuery.includes('export') || 
    lowerQuery.includes('download') || 
    (lowerQuery.includes('save') && (lowerQuery.includes('file') || lowerQuery.includes('document'))) ||
    lowerQuery.includes('export this') ||
    lowerQuery.includes('save this') ||
    lowerQuery.includes('download this') ||
    lowerQuery.includes('generate pdf') ||
    (lowerQuery.includes('pdf') && (lowerQuery.includes('this') || lowerQuery.includes('summary')));
  
  console.log('[AGENT] PDF pattern check:', hasPdf);
  
  // PRIORITY 1: Direct action commands - these override RAG responses
  // Email intent patterns - prioritize user query over RAG response
  if ((lowerQuery.includes('send') && lowerQuery.includes('email')) || 
      (lowerQuery.includes('write') && lowerQuery.includes('mail')) ||
      (lowerQuery.includes('write') && lowerQuery.includes('email')) ||
      (lowerQuery.includes('compose') && lowerQuery.includes('mail')) ||
      (lowerQuery.includes('compose') && lowerQuery.includes('email')) ||
      lowerQuery.includes('mail') || 
      (lowerQuery.includes('send') && lowerQuery.includes('@')) ||
      lowerQuery.includes('@gmail.com') ||
      lowerQuery.includes('@') ||
      // Strong action indicators - these should trigger regardless of RAG
      (lowerQuery.includes('send') && (lowerQuery.includes('summary') || lowerQuery.includes('document') || lowerQuery.includes('content'))) ||
      (lowerQuery.includes('email') && (lowerQuery.includes('this') || lowerQuery.includes('summary') || lowerQuery.includes('document'))) ||
      (lowerQuery.includes('mail') && (lowerQuery.includes('this') || lowerQuery.includes('summary') || lowerQuery.includes('content')))) {
    console.log('[AGENT] Email intent detected (ACTION COMMAND)');
    return 'send_email';
  }
  
  if (hasPdf) {
    console.log('[AGENT] PDF intent detected (ACTION COMMAND)');
    return 'generate_pdf';
  }
  
  // Schedule intent patterns - prioritize user query
  if (lowerQuery.includes('remind') || lowerQuery.includes('schedule') || 
      lowerQuery.includes('meeting') || lowerQuery.includes('appointment') ||
      (lowerQuery.includes('tomorrow') || lowerQuery.includes('today') || lowerQuery.includes('time')) ||
      // Strong action indicators for scheduling
      (lowerQuery.includes('remind') && (lowerQuery.includes('this') || lowerQuery.includes('about'))) ||
      (lowerQuery.includes('schedule') && (lowerQuery.includes('this') || lowerQuery.includes('for'))) ||
      (lowerQuery.includes('meeting') && (lowerQuery.includes('this') || lowerQuery.includes('about')))) {
    console.log('[AGENT] Schedule intent detected (ACTION COMMAND)');
    return 'schedule_event';
  }
  
  console.log('[AGENT] No action detected - treating as document query');
  return null;
}

// Generate chat summary from chat history
function generateChatSummary(chatHistory) {
  if (!chatHistory || chatHistory.length === 0) {
    return 'No chat history available for summary.';
  }
  
  console.log('[SUMMARY] Generating summary for', chatHistory.length, 'messages');
  
  let summary = 'Chat Summary from DocAI:\n\n';
  summary += `Total Messages: ${chatHistory.length}\n`;
  summary += `Date Range: ${new Date(chatHistory[0].timestamp).toLocaleDateString()} - ${new Date(chatHistory[chatHistory.length - 1].timestamp).toLocaleDateString()}\n\n`;
  
  // Count user vs assistant messages
  const userMessages = chatHistory.filter(msg => msg.role === 'user').length;
  const assistantMessages = chatHistory.filter(msg => msg.role === 'assistant').length;
  
  summary += `User Messages: ${userMessages}\n`;
  summary += `Assistant Messages: ${assistantMessages}\n\n`;
  
  // Extract key topics and actions
  const topics = [];
  const actions = [];
  
  chatHistory.forEach(msg => {
    const content = msg.content.toLowerCase();
    if (msg.role === 'user') {
      if (content.includes('email') || content.includes('send')) {
        actions.push('Email request');
      }
      if (content.includes('schedule') || content.includes('meeting')) {
        actions.push('Scheduling request');
      }
      if (content.includes('pdf') || content.includes('export')) {
        actions.push('PDF generation');
      }
      if (content.includes('vishwapratap') || content.includes('revande')) {
        topics.push('Vishwapratap Revande');
      }
    }
  });
  
  if (topics.length > 0) {
    summary += `Topics Discussed: ${[...new Set(topics)].join(', ')}\n`;
  }
  
  if (actions.length > 0) {
    summary += `Actions Requested: ${[...new Set(actions)].join(', ')}\n`;
  }
  
  summary += '\nConversation Flow:\n';
  
  // Show recent messages (last 5)
  const recentMessages = chatHistory.slice(-5);
  recentMessages.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
    summary += `${index + 1}. ${role}: ${content}\n`;
  });
  
  summary += '\nThis summary was generated by DocAI Assistant.';
  return summary;
}

// Generate chat summary from messages
function generateChatSummary(messages) {
  if (!messages || messages.length === 0) {
    return 'No chat history available for summary.';
  }
  
  let summary = 'Chat Summary:\n\n';
  
  messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = msg.content || msg.text || 'No content';
    summary += `${index + 1}. ${role}: ${content}\n`;
  });
  
  return summary;
}

// Extract document summary from RAG response and chat history
function extractDocumentSummary(ragResponse, chatHistory, query) {
  if (!ragResponse && !chatHistory) {
    return 'No document content available for summary.';
  }
  
  // If RAG response exists and seems substantial, use it as primary content
  if (ragResponse && ragResponse.length > 50) {
    // Simple filtering to remove system messages
    let cleanRagResponse = ragResponse;
    
    // Remove common system messages
    const systemMessages = [
      '✅ PDF generated successfully!',
      'I apologize, but I was unable to send the email',
      '📄 **Filename:',
      '🎯 **For Popup:',
      'Download Link:',
      'Your complete chat history has been exported'
    ];
    
    systemMessages.forEach(msg => {
      const startIndex = cleanRagResponse.indexOf(msg);
      if (startIndex !== -1) {
        const endIndex = cleanRagResponse.indexOf('\n', startIndex + msg.length);
        if (endIndex !== -1) {
          cleanRagResponse = cleanRagResponse.substring(0, startIndex) + cleanRagResponse.substring(endIndex + 1);
        } else {
          cleanRagResponse = cleanRagResponse.substring(0, startIndex);
        }
      }
    });
    
    cleanRagResponse = cleanRagResponse.trim();
    
    if (cleanRagResponse.length > 100) {
      return `Document Summary:\n\n${cleanRagResponse}`;
    }
  }
  
  // Fallback: extract document-related content from chat history
  if (chatHistory && chatHistory.length > 0) {
    let documentContent = '';
    
    // Look for user queries and assistant responses that contain actual document information
    chatHistory.forEach(msg => {
      const content = msg.content || msg.text || '';
      
      // Skip system messages and short content
      if (content.includes('✅ PDF generated') || 
          content.includes('unable to send the email') ||
          content.includes('📄 **Filename:') ||
          content.includes('🎯 **For Popup:') ||
          content.includes('Download Link:') ||
          content.length < 20) {
        return;
      }
      
      // Include substantial user queries and assistant responses
      if ((msg.role === 'user' && content.length > 20) || 
          (msg.role === 'assistant' && content.length > 100)) {
        documentContent += `${msg.role === 'user' ? 'Question:' : 'Answer:'} ${content}\n\n`;
      }
    });
    
    if (documentContent.length > 100) {
      return `Document Summary:\n\n${documentContent.trim()}`;
    }
  }
  
  // Final fallback - return a clean version of the RAG response
  if (ragResponse) {
    let cleanResponse = ragResponse;
    
    // Simple cleaning
    if (cleanResponse.includes('✅ PDF generated')) {
      cleanResponse = cleanResponse.split('✅ PDF generated')[0];
    }
    if (cleanResponse.includes('I apologize, but I was unable to send the email')) {
      cleanResponse = cleanResponse.split('I apologize, but I was unable to send the email')[0];
    }
    
    cleanResponse = cleanResponse.trim();
    
    if (cleanResponse.length > 20) {
      return `Document Summary:\n\n${cleanResponse}`;
    }
  }
  
  return 'Unable to generate document summary from available context.';
}

// Enhanced parameter extraction using both query and RAG response
async function extractParameters(query, ragResponse, action, sessionId, uid) {
  const lowerQuery = query.toLowerCase();
  const lowerRag = ragResponse ? ragResponse.toLowerCase() : '';
  
  console.log('[AGENT] Extracting parameters for action:', action);
  console.log('[AGENT] extractParameters - sessionId:', sessionId);
  
  switch (action) {
    case 'send_email':
      // Extract email address
      const emailMatch = query.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      const email = emailMatch ? emailMatch[0] : null;
      
      // Check if user wants chat summary or PDF or specific answer
      const wantsSummary = lowerQuery.includes('summary') || lowerQuery.includes('chat summary') || lowerQuery.includes('conversation summary');
      const wantsDocSummary = lowerQuery.includes('document summary') || 
        lowerQuery.includes('summary of this document') || 
        lowerQuery.includes('summary of uploaded document') || 
        lowerQuery.includes('summary of the document') ||
        lowerQuery.includes('document content summary') ||
        (lowerQuery.includes('summary') && (lowerQuery.includes('document') || lowerQuery.includes('uploaded') || lowerQuery.includes('file'))) ||
        lowerQuery.includes('what is this document about') ||
        lowerQuery.includes('summarize this document');
      const wantsPDF = lowerQuery.includes('pdf') || lowerQuery.includes('document') || lowerQuery.includes('attachment');
      const wantsAnswer = lowerQuery.includes('answer') || lowerQuery.includes('respond') || lowerQuery.includes('reply') || lowerQuery.includes('this answer') || lowerQuery.includes('include this answer');
      
      // Extract subject from query
      let subject = 'Document Summary from DocAI';
      if (lowerQuery.includes('subject') || lowerQuery.includes('about')) {
        const subjectMatch = query.match(/(?:subject|about)\s+(.+?)(?:\s+and|\s+with|\s+as|$)/i);
        if (subjectMatch) subject = subjectMatch[1].trim();
      } else if (wantsDocSummary) {
        subject = 'Document Summary from DocAI';
      } else if (wantsSummary) {
        subject = 'Chat Summary from DocAI';
      } else if (wantsPDF) {
        subject = 'Chat History PDF from DocAI';
      } else if (wantsAnswer) {
        subject = 'Response from DocAI';
      }
      
      let content = ragResponse || 'Document content from DocAI';
      let includePDF = false;
      let chatHistory = null;
      
      // Always fetch chat history for better email context
      console.log('[EMAIL] ===== EMAIL CHAT HISTORY FETCH =====');
      console.log('[EMAIL] Fetching chat history for email context...');
      console.log('[EMAIL] SessionId:', sessionId);
      console.log('[EMAIL] UserId:', uid);
      console.log('[EMAIL] Email type - wantsSummary:', wantsSummary, 'wantsDocSummary:', wantsDocSummary, 'wantsPDF:', wantsPDF, 'wantsAnswer:', wantsAnswer);
      
      try {
        // Import MongoDB model
        const Session = require('./models/Session');
        
        console.log('[EMAIL] Looking up session for email:', { userId: uid, sessionId: sessionId });
        
        const chatSession = await Session.findOne({ 
          userId: uid, 
          sessionId: sessionId 
        });
        console.log('[EMAIL] Session lookup result:', chatSession ? 'Found' : 'Not found');
        
        if (chatSession && chatSession.messages && chatSession.messages.length > 0) {
          const messageCount = chatSession.messages.length;
          console.log('[EMAIL] ✅ Found chat history with', messageCount, 'messages');
          
          chatHistory = chatSession.messages;
          
          // Generate appropriate content based on user request
          if (wantsDocSummary) {
            // User wants document summary - extract from RAG response or generate from chat
            content = extractDocumentSummary(ragResponse, chatHistory, query);
            console.log('[EMAIL] ✅ Document summary generated from query context');
          } else if (wantsSummary) {
            // User wants chat summary
            content = generateChatSummary(chatHistory);
            console.log('[EMAIL] ✅ Chat summary generated');
          } else if (wantsAnswer) {
            // User specifically wants just the answer - use only RAG response
            content = ragResponse || 'Response from DocAI';
            console.log('[EMAIL] ✅ Using only RAG response for specific answer request');
          }
          
          // Set PDF attachment flag if requested
          if (wantsPDF) {
            includePDF = true;
            console.log('[EMAIL] ✅ PDF attachment requested');
          }
          
          // For regular emails, enhance content with chat context ONLY if no specific request
          if (!wantsSummary && !wantsDocSummary && !wantsPDF && !wantsAnswer) {
            // Regular email - enhance with brief chat context
            const recentMessages = chatHistory.slice(-3);
            let contextInfo = `\n\nRecent Chat Context:\n`;
            recentMessages.forEach((msg, index) => {
              const role = msg.role === 'user' ? 'User' : 'Assistant';
              const content = msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
              contextInfo += `${index + 1}. ${role}: ${content}\n`;
            });
            content = ragResponse + contextInfo;
            console.log('[EMAIL] ✅ Enhanced email content with chat context');
          } else if (wantsAnswer) {
            // User specifically wants just the answer - use only RAG response
            content = ragResponse || 'Response from DocAI';
            console.log('[EMAIL] ✅ Using only RAG response for specific answer request');
          }
          
        } else {
          console.log('[EMAIL] ❌ No chat history found, using RAG response');
          content = ragResponse || 'No content available';
        }
      } catch (error) {
        console.error('[EMAIL] ❌ Error fetching chat history:', error);
        content = ragResponse || 'Error generating content';
      }
      console.log('[EMAIL] ===== END EMAIL CHAT HISTORY FETCH =====');
      
      console.log('[EMAIL] Email params:', { 
        email, 
        subject, 
        contentLength: content.length,
        wantsSummary,
        wantsDocSummary,
        wantsPDF,
        wantsAnswer,
        includePDF,
        hasChatHistory: !!chatHistory
      });
      
      return {
        email: email,
        subject: subject,
        content: content,
        includePDF: includePDF,
        chatHistory: chatHistory,
        wantsSummary: wantsSummary,
        wantsDocSummary: wantsDocSummary,
        wantsPDF: wantsPDF,
        wantsAnswer: wantsAnswer,
        query: query
      };
      
    case 'generate_pdf':
      // Extract filename from query if specified
      let filename = `docai-export-${Date.now()}.pdf`;
      if (lowerQuery.includes('filename') || lowerQuery.includes('name')) {
        const nameMatch = query.match(/(?:filename|name)\s+(.+?)(?:\s+as|\s+with|$)/i);
        if (nameMatch) filename = nameMatch[1].trim().replace(/\s+/g, '-') + '.pdf';
      }
      
      const pdfContent = ragResponse || 'Document content from DocAI';
      console.log('[AGENT] PDF params:', { filename, contentLength: pdfContent.length });
      console.log('[AGENT] PDF case - sessionId:', sessionId);
      console.log('[AGENT] PDF case - will add chat history if available');
      
      return {
        filename: filename,
        content: pdfContent,
        query: query
      };
      
    case 'schedule_event':
      console.log('[AGENT] ===== SCHEDULE EVENT CASE =====');
      // Enhanced time and date extraction
      console.log('[AGENT] Schedule event - Original query:', query);
      console.log('[AGENT] Schedule event - RAG response:', ragResponse ? ragResponse.substring(0, 100) + '...' : 'null');
      
      const timeMatch = query.match(/(\d{1,2}:\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm)|\d{1,2}:\d{2}|\d{1,2})/i);
      const dateMatch = query.match(/(today|tomorrow|next week|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/i);
      
      console.log('[AGENT] Schedule event query:', query);
      console.log('[AGENT] Time match:', timeMatch);
      console.log('[AGENT] Date match:', dateMatch);
      
      // Also try to extract from RAG response if not found in query
      let ragTimeMatch = null;
      let ragDateMatch = null;
      if (ragResponse && (!timeMatch || !dateMatch)) {
        console.log('[AGENT] Trying to extract time/date from RAG response...');
        ragTimeMatch = ragResponse.match(/(\d{1,2}:\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm)|\d{1,2}:\d{2}|\d{1,2})/i);
        ragDateMatch = ragResponse.match(/(today|tomorrow|next week|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/i);
        console.log('[AGENT] RAG time match:', ragTimeMatch);
        console.log('[AGENT] RAG date match:', ragDateMatch);
      }
      
      // Use query match first, fallback to RAG match
      const finalTimeMatch = timeMatch || ragTimeMatch;
      const finalDateMatch = dateMatch || ragDateMatch;
      
      console.log('[AGENT] Final time match:', finalTimeMatch);
      console.log('[AGENT] Final date match:', finalDateMatch);
      
      // Extract event description from RAG response
      let description = ragResponse || 'Meeting scheduled via DocAI';
      if (lowerQuery.includes('about') || lowerQuery.includes('for')) {
        const descMatch = query.match(/(?:about|for)\s+(.+?)(?:\s+at|\s+on|\s+$)/i);
        if (descMatch) description = descMatch[1].trim() + ' - ' + description;
      }
      
      const time = finalTimeMatch ? finalTimeMatch[1] : null;
      const date = finalDateMatch ? finalDateMatch[1] : null;
      
      console.log('[AGENT] Extracted time:', time);
      console.log('[AGENT] Extracted date:', date);
      console.log('[AGENT] Schedule params:', { time, date, description });
      
      const result = {
        time: finalTimeMatch ? finalTimeMatch[0] : null,
        date: finalDateMatch ? finalDateMatch[0] : 'tomorrow',
        description: description,
        query: query
      };
      
      console.log('[AGENT] Returning schedule params:', result);
      console.log('[AGENT] ===== END SCHEDULE EVENT CASE =====');
      
      return result;
      
    default:
      return {};
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'Agent controller is healthy' });
});

// Main agent execution endpoint
router.post('/execute', async (req, res) => {
  try {
    console.log('[AGENT] ===== AGENT REQUEST DEBUG =====');
    console.log('[AGENT] Request body:', JSON.stringify(req.body, null, 2));
    
    // Get authenticated user from middleware
    const uid = req.user && req.user.uid;
    if (!uid) {
      return res.status(401).json({ 
        error: 'unauthorized',
        action: null,
        status: 'failed'
      });
    }

    const { query, ragResponse, sessionId } = req.body;
    console.log('[AGENT] Extracted values:');
    console.log('[AGENT] - query:', query);
    console.log('[AGENT] - ragResponse:', ragResponse ? ragResponse.substring(0, 50) + '...' : 'null');
    console.log('[AGENT] - sessionId:', sessionId);
    console.log('[AGENT] - uid:', uid);
    console.log('[AGENT] - sessionId type:', typeof sessionId);
    console.log('[AGENT] - sessionId truthy:', !!sessionId);
    
    if (!query) {
      return res.status(400).json({ 
        error: 'query is required',
        action: null,
        status: 'failed'
      });
    }
    
    console.log('[AGENT] Received request:', { userId: uid, query, sessionId });
    console.log('[AGENT] Request timestamp:', new Date().toISOString());
    console.log('[AGENT] Full request body:', JSON.stringify(req.body, null, 2));
    
    // Detect intent
    const action = detectIntent(query, ragResponse);
    console.log('[AGENT] Detected action:', action);
    console.log('[AGENT] Processing command:', action);
    
    if (!action) {
      return res.json({
        action: null,
        status: 'no_action_detected',
        message: 'No action detected in the query'
      });
    }
    
    // Extract parameters
    const params = await extractParameters(query, ragResponse, action, sessionId, uid);
    console.log('[AGENT] Extracted parameters:', params);
    
    // For PDF generation, fetch entire chat history if sessionId provided
    if (action === 'generate_pdf' && sessionId) {
      console.log('[AGENT] ===== PDF CHAT HISTORY FETCH =====');
      console.log('[AGENT] PDF generation detected, fetching chat history...');
      console.log('[AGENT] SessionId:', sessionId);
      console.log('[AGENT] UserId:', uid);
      
      try {
        // Import MongoDB model
        const Session = require('./models/Session');
        
        console.log('[AGENT] Looking up session:', { userId: uid, sessionId: sessionId });
        
        const chatSession = await Session.findOne({ 
          userId: uid, 
          sessionId: sessionId 
        });
        
        console.log('[AGENT] Session lookup result:', chatSession ? 'Found' : 'Not found');
        
        if (chatSession && chatSession.messages && chatSession.messages.length > 0) {
          const messageCount = chatSession.messages.length;
          console.log('[AGENT] ✅ Found chat history with', messageCount, 'messages');
          console.log('[AGENT] First message:', chatSession.messages[0].text?.substring(0, 50) + '...');
          console.log('[AGENT] Last message:', chatSession.messages[messageCount - 1].text?.substring(0, 50) + '...');
          
          params.chatHistory = chatSession.messages;
          console.log('[AGENT] ✅ Chat history added to PDF params');
        } else {
          console.log('[AGENT] ❌ No chat history found, using single response');
          console.log('[AGENT] chatSession exists:', !!chatSession);
          console.log('[AGENT] messages array exists:', !!(chatSession && chatSession.messages));
          console.log('[AGENT] messages length:', chatSession ? chatSession.messages.length : 0);
          params.chatHistory = null;
        }
      } catch (error) {
        console.error('[AGENT] ❌ Error fetching chat history:', error);
        params.chatHistory = null;
      }
      console.log('[AGENT] ===== END PDF CHAT HISTORY FETCH =====');
    }
    
    let result;
    
    // Execute corresponding action
    switch (action) {
      case 'send_email':
        result = await emailHandler.sendEmail(params, uid);
        break;
        
      case 'generate_pdf':
        result = await pdfHandler.generatePDF(params, uid);
        break;
        
      case 'schedule_event':
        result = await schedulerHandler.scheduleEvent(params, uid);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    console.log('[AGENT] Action completed:', { action, status: result.status });
    
    res.json({
      action: action,
      status: result.status,
      data: result.data || null,
      message: result.message || 'Action completed successfully'
    });
    
  } catch (error) {
    console.error('[AGENT] Error executing action:', error);
    res.status(500).json({
      action: req.body.action || null,
      status: 'failed',
      error: error.message
    });
  }
});

// Health check for agent service
router.get('/health', (req, res) => {
  res.json({ 
    service: 'agent-controller',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
