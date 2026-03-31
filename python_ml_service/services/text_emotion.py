from transformers import pipeline
import logging
import json
import os

logging.basicConfig(level=logging.WARNING)

_emotion_pipeline = None

# Confidence threshold: if top emotion score < this, return neutral
# Adjusted to 0.35 for better emotion capture (j-hartmann model scores)
EMOTION_CONFIDENCE_THRESHOLD = 0.35

# Emotion mapping: raw model outputs → our custom emotion set
# Model: j-hartmann/emotion-english-distilroberta-base
# Outputs: anger, disgust, fear, joy, neutral, sadness, surprise
EMOTION_MAPPING = {
    # Direct mappings (high priority)
    "joy": "happy",
    "happiness": "happy",
    
    "anger": "frustrated",
    "frustrated": "frustrated",
    "annoyance": "frustrated",
    
    "fear": "confused",
    "anxiety": "confused",
    # "doesn't": "confused",
    
    "sadness": "sad",
    "sad": "sad",
    
    "disgust": "frustrated",
    "contempt": "frustrated",
    
    "surprise": "neutral",  # Neutral emotional stance on surprise
    
    # Default
    "neutral": "neutral",
}

# Custom keyword-based emotion detection
# Add your specific phrases and words here
KEYWORD_EMOTIONS = {
    "frustrated": [
        "i am frustrated", "so frustrated", "very frustrated", "really frustrated",
        "this is frustrating", "getting frustrated", "makes me frustrated",
        "i'm frustrated", "im frustrated", "pissed off", "so annoying", "this is garbage"
    ],
    "happy": [
        "i am happy", "so happy", "very happy", "really happy", "excited",
        "this is great", "that's great", "awesome", "amazing", "fantastic",
        "love this", "i love", "feeling great", "wonderful", "excellent"
    ],
    "sad": [
        "i am sad", "so sad", "very sad", "really sad", "depressed",
        "this is sad", "feeling sad", "makes me sad", "i feel sad",
        "making me sad", "terrible", "awful", "horrible", "devastated", "heartbroken"
    ],
    "confused": [
        "i am confused", "so confused", "very confused", "really confused",
        "i don't understand", "dont understand", "doesn't make sense",
        "this is confusing", "this is very confusing", "i'm lost", "what do you mean", 
        "i don't get it", "doesnt make sense", "not clear", "i'm confused about",
        "can't figure out", "cant figure out", "not sure what to do"
    ]
}

# Adaptive emotion learning system
EMOTION_LEARNING_FILE = "emotion_learning.json"

def load_emotion_patterns():
    """Load learned emotion patterns from file."""
    if os.path.exists(EMOTION_LEARNING_FILE):
        try:
            with open(EMOTION_LEARNING_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"patterns": {}, "confidence_boost": {}}

def save_emotion_patterns(patterns):
    """Save learned emotion patterns to file."""
    try:
        with open(EMOTION_LEARNING_FILE, 'w') as f:
            json.dump(patterns, f, indent=2)
    except Exception as e:
        logging.warning(f"Failed to save emotion patterns: {e}")

def learn_emotion_pattern(text: str, emotion: str):
    """Learn from user feedback to improve future detection."""
    patterns = load_emotion_patterns()
    
    # Extract meaningful phrases only (avoid single words)
    words = text.lower().split()
    key_phrases = []
    
    # Create 2-4 word phrases, but filter out generic words
    generic_words = {'this', 'that', 'with', 'for', 'from', 'have', 'been', 'are', 'was', 'were', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'of'}
    
    # Create meaningful phrases (2-4 words, avoiding generic words)
    for i in range(len(words)):
        for j in range(i+2, min(i+5, len(words)+1)):  # Start with 2-word phrases
            phrase = ' '.join(words[i:j])
            # Skip if phrase contains too many generic words or is too short
            phrase_words = set(phrase.split())
            generic_count = len(phrase_words & generic_words)
            if len(phrase) >= 6 and generic_count <= len(phrase.split()) // 2:
                key_phrases.append(phrase)
    
    # Store patterns
    for phrase in key_phrases:
        if phrase not in patterns["patterns"]:
            patterns["patterns"][phrase] = {}
        if emotion not in patterns["patterns"][phrase]:
            patterns["patterns"][phrase][emotion] = 0
        patterns["patterns"][phrase][emotion] += 1
    
    save_emotion_patterns(patterns)

def detect_adaptive_emotion(text: str) -> dict:
    """Detect emotion using learned patterns."""
    patterns = load_emotion_patterns()
    text_lower = text.lower()
    
    emotion_scores = {}
    
    # Check against learned patterns
    for phrase, emotions in patterns["patterns"].items():
        if phrase in text_lower:
            for emotion, count in emotions.items():
                if emotion not in emotion_scores:
                    emotion_scores[emotion] = 0
                emotion_scores[emotion] += count
    
    if emotion_scores:
        # Return emotion with highest score
        best_emotion = max(emotion_scores, key=emotion_scores.get)
        confidence = min(0.9, 0.5 + (emotion_scores[best_emotion] / 10))
        return {
            "emotion": best_emotion,
            "confidence": confidence,
            "raw_label": best_emotion,
            "all_scores": emotion_scores,
            "detection_method": "adaptive"
        }
    
    return None


def detect_keyword_emotion(text: str) -> str:
    """Check for keyword-based emotions before ML model."""
    text_lower = text.lower().strip()
    
    for emotion, keywords in KEYWORD_EMOTIONS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return emotion
    
    return None  # No keyword match found


def get_emotion_pipeline():
    """
    Load and cache the emotion classification pipeline.
    Uses: j-hartmann/emotion-english-distilroberta-base
    (Better accuracy, supports 7 emotions including neutral)
    """
    global _emotion_pipeline
    if _emotion_pipeline is None:
        _emotion_pipeline = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            top_k=None,  # Get all scores to check confidence (replaces deprecated return_all_scores)
            truncation=True,
            max_length=512,
            device=-1,  # CPU (use 0 for GPU if available)
        )
    return _emotion_pipeline


def map_emotion_label(raw_label: str) -> str:
    """
    Map raw model output to our custom emotion set.
    """
    key = raw_label.strip().lower()
    return EMOTION_MAPPING.get(key, "neutral")


def detect_text_emotion(text: str) -> dict:
    """
    Detect emotion from text with confidence scoring.
    
    Args:
        text: User input text
        
    Returns:
        {
            "emotion": str (one of: happy, frustrated, confused, sad, neutral),
            "confidence": float (0-1),
            "raw_label": str (model's direct output),
            "all_scores": dict (debug info)
        }
    """
    if not text or not text.strip():
        return {
            "emotion": "neutral",
            "confidence": 1.0,
            "raw_label": "neutral",
            "all_scores": {}
        }

    # Priority order: Adaptive > Keywords > ML
    # 1. Check adaptive learning patterns first
    adaptive_result = detect_adaptive_emotion(text)
    if adaptive_result:
        return adaptive_result
    
    # 2. Check for keyword-based emotions
    keyword_emotion = detect_keyword_emotion(text)
    if keyword_emotion:
        return {
            "emotion": keyword_emotion,
            "confidence": 1.0,  # High confidence for keyword matches
            "raw_label": keyword_emotion,
            "all_scores": {},
            "detection_method": "keyword"
        }

    # 3. Fall back to ML model
    try:
        pipe = get_emotion_pipeline()
        results = pipe(text)  # Returns [[{label, score}]] - nested list
        
        # Extract the actual emotion scores from the nested list
        emotion_scores = results[0] if isinstance(results, list) and len(results) > 0 else results
        
        # Find the top emotion
        top_result = max(emotion_scores, key=lambda x: x["score"])
        raw_label = top_result["label"]
        confidence = top_result["score"]
        
        # Debug: store all scores
        all_scores = {r["label"]: round(r["score"], 4) for r in emotion_scores}
        
        # If confidence is below threshold, default to neutral
        if confidence < EMOTION_CONFIDENCE_THRESHOLD:
            return {
                "emotion": "neutral",
                "confidence": confidence,
                "raw_label": raw_label,
                "all_scores": all_scores,
                "reason": "confidence_below_threshold"
            }
        
        # Map to our emotion set
        mapped_emotion = map_emotion_label(raw_label)
        
        return {
            "emotion": mapped_emotion,
            "confidence": round(confidence, 4),
            "raw_label": raw_label,
            "all_scores": all_scores
        }
        
    except Exception as e:
        logging.error(f"Emotion detection error: {str(e)}")
        return {
            "emotion": "neutral",
            "confidence": 0.0,
            "raw_label": "error",
            "all_scores": {},
            "error": str(e)
        }
