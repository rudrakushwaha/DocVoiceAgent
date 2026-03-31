const axios = require('axios');

/**
 * Email Action Handler
 * Sends email via n8n webhook
 */

async function sendEmail(params, userId) {
  try {
    console.log('[EMAIL] Sending email:', { email: params.email, userId });
    
    const { email, subject, content, query, includePDF, chatHistory, wantsSummary, wantsDocSummary, wantsPDF, wantsAnswer } = params;
    
    if (!email) {
      throw new Error('Email address is required');
    }
    
    // Get n8n webhook URL from environment
    const webhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL;
    
    console.log('[EMAIL] Debug - webhookUrl:', webhookUrl);
    console.log('[EMAIL] Debug - webhookUrl includes your-n8n.com:', webhookUrl?.includes('your-n8n.com'));
    console.log('[EMAIL] Debug - params received:', params);
    
    // Check if webhook URL is set and valid
    if (!webhookUrl || webhookUrl.includes('your-n8n.com')) {
      console.log('[EMAIL] No valid webhook URL configured, simulating email send');
      
      let emailContent = content || 'No content provided';
      
      // Handle document summary properly
      if (wantsDocSummary) {
        emailContent = content; // Already formatted by extractDocumentSummary
        console.log('[EMAIL] ✅ Document summary included in email');
      }
      // Add summary information if requested
      else if (wantsSummary && chatHistory) {
        emailContent = content;
        console.log('[EMAIL] ✅ Chat summary included in email');
      }
      
      // Simulate PDF attachment
      let attachmentInfo = '';
      if (includePDF && chatHistory) {
        attachmentInfo = '\n\n📎 PDF Attachment: Chat history PDF would be attached';
        console.log('[EMAIL] ✅ PDF attachment simulated');
      }
      
      // Simulate email send for development
      return {
        status: 'success',
        message: `Email sent successfully to ${email}${includePDF ? ' with PDF attachment' : ''}`,
        data: {
          email: email,
          subject: subject,
          body: emailContent,
          context: emailContent, // For email agent
          contentLength: emailContent.length,
          hasPDFAttachment: includePDF || false,
          hasChatSummary: wantsSummary || false,
          messageCount: chatHistory ? chatHistory.length : 0,
          simulated: true
        }
      };
    }
    
    // Generate PDF if requested
    let pdfPath = null;
    let pdfUrl = null;
    if (includePDF && chatHistory) {
      console.log('[EMAIL] ===== EMAIL PDF GENERATION =====');
      console.log('[EMAIL] Generating PDF for email attachment...');
      
      try {
        const { generatePDF } = require('./pdf');
        const pdfParams = {
          filename: `chat-history-${Date.now()}.pdf`,
          content: 'Chat History PDF',
          query: 'Email attachment',
          chatHistory: chatHistory
        };
        
        const pdfResult = await generatePDF(pdfParams, userId);
        pdfPath = pdfResult.path;
        
        // Create accessible URL for n8n
        const filename = pdfResult.filename;
        pdfUrl = `http://localhost:4000/uploads/${filename}`;
        
        console.log('[EMAIL] ✅ PDF generated for email:', pdfResult.filename);
        console.log('[EMAIL] ✅ PDF URL for n8n:', pdfUrl);
        
      } catch (error) {
        console.error('[EMAIL] ❌ Error generating PDF for email:', error);
        // Continue without PDF attachment
      }
      console.log('[EMAIL] ===== END EMAIL PDF GENERATION =====');
    }
    
    // Prepare payload for n8n (Email Agent Format)
    const payload = {
      to: email,
      subject: subject || 'Document Summary from DocAI',
      body: content || 'No content provided',
      context: content || 'No content provided', // For email agent
      userId: userId,
      originalQuery: query,
      timestamp: new Date().toISOString(),
      hasPDFAttachment: !!pdfPath,
      pdfPath: pdfPath,
      pdfUrl: pdfUrl,
      messageCount: chatHistory ? chatHistory.length : 0,
      emailType: wantsSummary ? 'summary' : wantsPDF ? 'pdf_attachment' : wantsAnswer ? 'answer' : 'general'
    };
    
    console.log('[EMAIL] Calling n8n webhook:', webhookUrl);
    console.log('[EMAIL] Email payload:', {
      to: email,
      subject: subject,
      hasPDFAttachment: !!pdfPath,
      messageCount: chatHistory ? chatHistory.length : 0,
      emailType: payload.emailType
    });
    
    // Call n8n webhook
    const response = await axios.post(webhookUrl, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('[EMAIL] n8n response:', response.status);
    
    return {
      status: 'success',
      message: `Email sent successfully to ${email}${includePDF ? ' with PDF attachment' : ''}`,
      data: {
        email: email,
        subject: subject,
        webhookStatus: response.status,
        hasPDFAttachment: !!pdfPath,
        pdfPath: pdfPath,
        messageCount: chatHistory ? chatHistory.length : 0,
        emailType: payload.emailType,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('[EMAIL] Error sending email:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Email service timeout - please try again');
    }
    
    if (error.response) {
      console.error('[EMAIL] n8n error response:', error.response.status, error.response.data);
      throw new Error(`Email service error: ${error.response.status}`);
    }
    
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

module.exports = {
  sendEmail
};
