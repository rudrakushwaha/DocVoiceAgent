"""
Test suite for improved emotion detection system.
Run: python test_emotion_detection.py
"""

from services.text_emotion import detect_text_emotion
import json


def test_cases():
    """Test emotion detection with various inputs."""
    
    test_inputs = [
        # Happy cases
        ("Everything is great!", "happy"),
        ("This is awesome", "happy"),
        ("I love this!", "happy"),
        ("Amazing work!", "happy"),
        
        # Frustrated cases
        ("I don't understand this", "frustrated"),  # was: confused, now: frustrated + confused
        ("This makes no sense", "frustrated"),
        ("I am frustrated", "frustrated"),
        ("This is so annoying!", "frustrated"),
        ("This is garbage", "frustrated"),
        
        # Confused cases
        ("I'm lost, can you explain step-by-step?", "confused"),
        ("What does this mean?", "confused"),
        ("I don't get it", "confused"),
        ("This is confusing", "confused"),
        
        # Sad cases
        ("I'm so sad", "sad"),
        ("This is terrible", "sad"),
        ("I feel depressed", "sad"),
        
        # Neutral cases
        ("What time is it?", "neutral"),
        ("Tell me about documents", "neutral"),
        ("How do I use this?", "neutral"),
        ("", "neutral"),  # Empty string
        
        # Ambiguous (might default to neutral if confidence low)
        ("ok", "neutral"),
        ("yes", "neutral"),
    ]
    
    print("=" * 80)
    print("EMOTION DETECTION TEST SUITE")
    print("=" * 80)
    print()
    
    results = []
    for text, expected_emotion in test_inputs:
        result = detect_text_emotion(text)
        emotion = result["emotion"]
        confidence = result["confidence"]
        raw_label = result["raw_label"]
        
        # Check if result matches expectation
        status = "✓ PASS" if emotion == expected_emotion else "✗ FAIL"
        
        results.append({
            "text": text[:50] if text else "(empty)",
            "expected": expected_emotion,
            "detected": emotion,
            "confidence": confidence,
            "raw_label": raw_label,
            "status": status
        })
        
        print(f"{status} | Text: '{text[:40] if text else '(empty)'}...'")
        print(f"       Expected: {expected_emotion:12} | Detected: {emotion:12} (confidence: {confidence:.2f})")
        print(f"       Raw model output: {raw_label}")
        print()
    
    # Summary
    passed = sum(1 for r in results if "PASS" in r["status"])
    total = len(results)
    
    print("=" * 80)
    print(f"SUMMARY: {passed}/{total} tests passed")
    print("=" * 80)
    
    # Print detailed table
    print("\nDetailed Results:")
    print("-" * 100)
    print(f"{'Text':<45} | {'Expected':<12} | {'Detected':<12} | {'Confidence':<10} | {'Status':<8}")
    print("-" * 100)
    for r in results:
        print(f"{r['text']:<45} | {r['expected']:<12} | {r['detected']:<12} | {r['confidence']:<10.2f} | {r['status']:<8}")
    print("-" * 100)


def test_confidence_threshold():
    """Test confidence threshold behavior."""
    
    print("\n" + "=" * 80)
    print("CONFIDENCE THRESHOLD TEST")
    print("=" * 80)
    print()
    
    # Text that might trigger low confidence
    ambiguous_text = "hm"
    result = detect_text_emotion(ambiguous_text)
    
    print(f"Input: '{ambiguous_text}'")
    print(f"Detected emotion: {result['emotion']}")
    print(f"Confidence: {result['confidence']:.4f}")
    print(f"Threshold: 0.45")
    print(f"Reason: {result.get('reason', 'confidence_above_threshold')}")
    print()


def test_all_scores_debug():
    """Show all emotion scores for a sample text."""
    
    print("\n" + "=" * 80)
    print("DEBUG: ALL EMOTION SCORES")
    print("=" * 80)
    print()
    
    test_text = "I'm really frustrated with this!"
    result = detect_text_emotion(test_text)
    
    print(f"Input: '{test_text}'")
    print(f"Top emotion: {result['emotion']} (confidence: {result['confidence']:.4f})")
    print(f"Raw model label: {result['raw_label']}")
    print()
    print("All model scores:")
    if result.get("all_scores"):
        for label, score in sorted(result["all_scores"].items(), key=lambda x: x[1], reverse=True):
            bar = "█" * int(score * 50)
            print(f"  {label:12} | {score:.4f} | {bar}")
    print()


if __name__ == "__main__":
    test_cases()
    test_confidence_threshold()
    test_all_scores_debug()
    print("\n✓ All tests completed!")
