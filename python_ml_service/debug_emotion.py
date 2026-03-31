#!/usr/bin/env python
"""Quick test to diagnose emotion detection"""

from services.text_emotion import detect_text_emotion
import json

test_text = "Everything is going great! I'd love to learn more about content in provided document."

print("=" * 80)
print("TESTING EMOTION DETECTION")
print("=" * 80)
print(f"\nInput: {test_text}\n")

result = detect_text_emotion(test_text)

print("Result:")
print(json.dumps(result, indent=2))

print("\n" + "=" * 80)
print(f"Detected Emotion: {result['emotion']}")
print(f"Confidence: {result['confidence']:.4f}")
print(f"Raw Label: {result['raw_label']}")
print(f"Threshold: 0.45")
print(f"Status: {'ABOVE threshold ✓' if result['confidence'] >= 0.45 else 'BELOW threshold ✗'}")
print("=" * 80)
