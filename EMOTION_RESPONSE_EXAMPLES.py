"""
EMOTION-AWARE RESPONSE STYLE EXAMPLES
This file demonstrates how responses adapt based on detected user emotion.

The RAG system now includes comprehensive emotion-specific instructions that guide
the LLM to adjust tone, structure, length, and delivery based on emotional context.
"""

# Sample query that would be sent in all cases:
USER_QUERY = "How do I set up document management in this system?"

# ============================================================================
# RESPONSE 1: FRUSTRATED USER
# ============================================================================
"""
Detected Emotion: frustrated
Confidence: 0.82
Raw Label: anger

Example Input: "This is really frustrating! I've tried everything but nothing works!"

Response Parameters:
  - Temperature: 0.3 (conservative/predictable)
  - Max Tokens: 400 (concise)
  - Key Instructions:
    ✓ START with empathy
    ✓ SIMPLIFY language and structure
    ✓ Use bullet points for clarity
    ✓ Keep to 2-3 paragraphs MAX
    ✓ Offer solutions and next steps

Expected Response Style:
---
I completely understand your frustration – let me break this down into simple steps.

**Here's the quickest path to set up document management:**
• Step 1: Log in and go to Settings
• Step 2: Click "Documents" from the menu
• Step 3: Upload your first file
• Step 4: You're done!

If any of these steps feel unclear, just let me know which one and I'll walk through it 
with you. We'll get this working smoothly.
---

Key Characteristics:
- Acknowledges frustration explicitly
- Uses simple vocabulary (no jargon)
- Clear numbered/bulleted lists
- Reassuring, supportive tone
- Ends with offer to help further
- Short and to-the-point
"""

# ============================================================================
# RESPONSE 2: CONFUSED USER
# ============================================================================
"""
Detected Emotion: confused
Confidence: 0.74
Raw Label: fear

Example Input: "I'm lost, can you explain step-by-step?"

Response Parameters:
  - Temperature: 0.25 (very controlled)
  - Max Tokens: 550 (detailed explanation)
  - Key Instructions:
    ✓ START by validating the question
    ✓ Provide STEP-BY-STEP explanation
    ✓ Include CONCRETE EXAMPLES
    ✓ Define technical terms
    ✓ End with offer to clarify further

Expected Response Style:
---
That's a great question – document management can seem confusing at first. Let me 
walk you through exactly how it works.

**First, let's understand the basics:**
Document management is simply an organized way to store and find your files. Think of it 
like creating a filing cabinet in the cloud – instead of paper folders, you have digital 
folders. [From Document 1]

**Second, here's the key setup process:**
1. Create a workspace (this is your main folder)
2. Upload documents to the workspace
3. Use the search function to find what you need
4. Share documents with team members if needed

**Finally, here's a concrete example:**
Let's say you have a contract file called "client_agreement.pdf". When you upload it:
• It gets stored in your workspace
• The system reads and indexes it
• You can search for "client agreement" and find it instantly
• You can share it with your team

Does this help clarify how it works? Feel free to ask about any specific part!
---

Key Characteristics:
- Validates the question positively
- Breaks down into digestible steps
- Uses concrete examples
- Defines terminology clearly
- Patient and educational tone
- Offers to answer follow-up questions
- Longer and more detailed
"""

# ============================================================================
# RESPONSE 3: HAPPY/POSITIVE USER
# ============================================================================
"""
Detected Emotion: happy
Confidence: 0.87
Raw Label: joy

Example Input: "Everything is going great! I'd love to learn more about document management!"

Response Parameters:
  - Temperature: 0.5 (creative/engaging)
  - Max Tokens: 550 (exploratory)
  - Key Instructions:
    ✓ MATCH ENERGY - be enthusiastic
    ✓ Be conversational and friendly
    ✓ CELEBRATE their momentum
    ✓ Go deeper with confidence
    ✓ Suggest next steps or exploration

Expected Response Style:
---
That's fantastic! I love the enthusiasm – document management is actually quite powerful 
when you get into it.

**Here's what makes it so great:**
You can set it up in minutes, and it immediately streamlines how you work. [From Document 3]
The system automatically:
• Indexes your documents for instant searching
• Keeps version history so you can track changes
• Allows seamless team collaboration
• Provides security features to protect your files

**Want to explore the advanced features?**
Once you have the basics down, you can:
- Set up automated workflows to organize documents
- Create custom metadata tags for better organization
- Configure access permissions for different team members
- Generate reports on document usage

The possibilities really open up once you're comfortable with the fundamentals! 
Would you like me to dive deeper into any of these features?
---

Key Characteristics:
- Enthusiastic and engaging tone
- Matches user's positive energy
- Celebrates their progress
- Explores possibilities and advanced features
- Conversational and collaborative
- Offers deeper exploration
- Longer and more detailed
"""

# ============================================================================
# RESPONSE 4: SAD/DEJECTED USER
# ============================================================================
"""
Detected Emotion: sad
Confidence: 0.91
Raw Label: sadness

Example Input: "I've been struggling with this for hours and nothing works..."

Response Parameters:
  - Temperature: 0.35 (supportive)
  - Max Tokens: 450 (balanced)
  - Key Instructions:
    ✓ ACKNOWLEDGE emotional state
    ✓ ENCOURAGE positive perspective
    ✓ HIGHLIGHT what CAN be done
    ✓ Be supportive throughout
    ✓ End with constructive next steps

Expected Response Style:
---
I hear you – that sounds frustrating and discouraging. But here's the good news: 
document management is actually straightforward, and I can help you get it working.

**Let's focus on what we CAN do:**
Right now, we're going to take a simple, direct approach:

1. First, let's verify your account is set up correctly
2. Then we'll do one successful document upload together
3. Once that works, everything becomes much easier

**Here's why this will work:**
You're almost certainly just one small step away from getting it right. Most setup 
issues are simple fixes. [From Documentation - Setup Guide]

**Your next step:**
Let's start with the basics – tell me:
• Can you see the "Upload" button in your dashboard?
• What error message (if any) do you see?

Once we answer these two questions, I can guide you to the solution. You've got this, 
and I'm here to help make it work.
---

Key Characteristics:
- Acknowledges emotional state with compassion
- Provides reassurance and encouragement
- Focuses on solutions and what's possible
- Supportive and gentle tone
- Offers constructive path forward
- Uses positive framing
- Actionable next steps
"""

# ============================================================================
# RESPONSE 5: NEUTRAL USER
# ============================================================================
"""
Detected Emotion: neutral
Confidence: 0.95
Raw Label: neutral

Example Input: "How do I set up document management?"

Response Parameters:
  - Temperature: 0.2 (very factual)
  - Max Tokens: 400 (concise)
  - Key Instructions:
    ✓ BE FACTUAL and accurate
    ✓ BE CONCISE with clear language
    ✓ ORGANIZE logically
    ✓ Provide actionable information
    ✓ Maintain professional tone

Expected Response Style:
---
Document management setup follows these steps:

**Setup Process:**
1. Navigate to Settings > Documents
2. Click "Enable Document Management"
3. Configure storage location (cloud or local)
4. Set user permissions [From Admin Guide, Page 5]
5. Upload test documents to verify

**Key Configuration Options:**
- Storage capacity: Configurable per user
- Retention policy: Default is 1 year of versions
- Access levels: Admin, Editor, Viewer
- Search indexing: Automatic

**Results:**
Once configured, documents are immediately searchable and sharable within the system.
---

Key Characteristics:
- Direct and factual presentation
- Professional tone
- Logical organization
- Cited sources
- Concise and clear
- No unnecessary elaboration
- Action-oriented
"""

# ============================================================================
# RESPONSE PARAMETER COMPARISON
# ============================================================================

PARAMETER_COMPARISON = {
    "frustrated": {
        "temperature": 0.3,
        "max_tokens": 400,
        "tone": "Empathetic, Supportive",
        "structure": "Simplified, Bulleted",
        "length": "Short (2-3 paragraphs)",
        "opening": "Acknowledge frustration",
        "closing": "Offer to clarify further"
    },
    "confused": {
        "temperature": 0.25,
        "max_tokens": 550,
        "tone": "Patient, Educational",
        "structure": "Step-by-step, Examples",
        "length": "Detailed (3-4 paragraphs)",
        "opening": "Validate the question",
        "closing": "Ask if they need clarification"
    },
    "happy": {
        "temperature": 0.5,
        "max_tokens": 550,
        "tone": "Enthusiastic, Engaging",
        "structure": "Exploratory, Detailed",
        "length": "Detailed (3-4 paragraphs)",
        "opening": "Match their energy",
        "closing": "Suggest deeper exploration"
    },
    "sad": {
        "temperature": 0.35,
        "max_tokens": 450,
        "tone": "Compassionate, Encouraging",
        "structure": "Supportive, Solution-focused",
        "length": "Balanced (2-3 paragraphs)",
        "opening": "Acknowledge their state",
        "closing": "Constructive next steps"
    },
    "neutral": {
        "temperature": 0.2,
        "max_tokens": 400,
        "tone": "Professional, Factual",
        "structure": "Organized, Logical",
        "length": "Concise (2-3 paragraphs)",
        "opening": "Direct answer",
        "closing": "Sources cited"
    }
}

# ============================================================================
# HOW THIS WORKS IN THE SYSTEM
# ============================================================================

SYSTEM_FLOW = """
1. User types or speaks: "I don't understand this!"
   ↓
2. Frontend detects emotion:
   - Call: detectTextEmotion(user_input)
   - Result: emotion="confused", confidence=0.74
   ↓
3. Send to backend with emotion:
   - POST /api/query/ask with emotion="confused"
   ↓
4. Backend forwards to Python ML Service:
   - POST /query-rag with emotion="confused"
   ↓
5. Python service loads EMOTION_CONFIG["confused"]:
   - Uses detailed system instructions
   - Sets temperature=0.25 (conservative)
   - Sets max_tokens=550 (detailed response)
   ↓
6. System prompt guides LLM:
   "CRITICAL: The user is CONFUSED. Your response MUST:
    1. START by validating...
    2. STRUCTURE: Provide step-by-step...
    [etc.]"
   ↓
7. LLM generates response adapted to "confused" emotion:
   - Step-by-step structure
   - Concrete examples
   - Definition of terms
   ↓
8. Response returned to frontend with emotion indicator:
   - UI shows: 🤔 CONFUSED
   - Message displays emotion-adapted response
"""

# ============================================================================
# KEY IMPROVEMENTS FROM EMOTION-AWARE RESPONSES
# ============================================================================

IMPROVEMENTS = {
    "Before": {
        "description": "Static response",
        "tone": "One-size-fits-all professional",
        "length": "Fixed 500 tokens",
        "structure": "Standard paragraphs",
        "user_experience": "Generic, impersonal"
    },
    "After": {
        "description": "Dynamic, emotion-adapted response",
        "tone": "Adapts to emotional context",
        "length": "400-550 tokens based on emotion",
        "structure": "Optimized per emotion (bullets, steps, etc.)",
        "user_experience": "Personalized, empathetic, engaging"
    }
}

if __name__ == "__main__":
    print("=" * 80)
    print("EMOTION-AWARE RESPONSE STYLE GUIDE")
    print("=" * 80)
    print("\nThis system now adapts response style to user emotion:")
    print("- Frustrated → Empathetic, simplified")
    print("- Confused → Step-by-step, detailed")
    print("- Happy → Enthusiastic, exploratory")
    print("- Sad → Supportive, encouraging")
    print("- Neutral → Professional, factual")
    print("\nEach emotion gets optimized temperature, token limits, and system instructions.")
    print("=" * 80)
