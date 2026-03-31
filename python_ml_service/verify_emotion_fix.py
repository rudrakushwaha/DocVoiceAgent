#!/usr/bin/env python
"""
Verify emotion detection with new 0.35 threshold
Run: python verify_emotion_fix.py
"""

from services.text_emotion import detect_text_emotion

test_cases = [
    ("Everything is going great! I'd love to learn more about content in provided document.", "happy"),
    ("I don't understand this", "frustrated"),  
    ("I'm confused, explain please", "confused"),
    ("This is awesome!", "happy"),
    ("I'm so sad", "sad"),
    ("Tell me about files", "neutral"),
]

print("=" * 90)
print("EMOTION DETECTION VERIFICATION (Threshold: 0.35)")
print("=" * 90)

passed = 0
failed = 0

for text, expected in test_cases:
    result = detect_text_emotion(text)
    emotion = result["emotion"]
    confidence = result["confidence"]
    status = "✓ PASS" if emotion == expected else "✗ FAIL"
    
    if emotion == expected:
        passed += 1
    else:
        failed += 1
    
    print(f"\n{status}")
    print(f"  Input: '{text[:60]}...'")
    print(f"  Expected: {expected:12} | Got: {emotion:12} | Confidence: {confidence:.4f}")
    print(f"  Raw: {result['raw_label']}")
    
    if "reason" in result:
        print(f"  Note: {result['reason']}")

print("\n" + "=" * 90)
print(f"Results: {passed} passed, {failed} failed out of {len(test_cases)}")
print("=" * 90)

if failed == 0:
    print("\n✅ All tests passed! Emotion detection is working correctly.")
else:
    print(f"\n⚠️  {failed} test(s) failed. Check logs or check if model needs to download.")
