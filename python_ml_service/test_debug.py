import os
import sys
from dotenv import load_dotenv

load_dotenv()

print("=== Environment Variables Check ===")
print(f"OPENAI_API_KEY: {'✅ Set' if os.environ.get('OPENAI_API_KEY') else '❌ Missing'}")
print(f"MONGO_URI: {'✅ Set' if os.environ.get('MONGO_URI') else '❌ Missing'}")
print(f"MONGO_DB: {'✅ Set' if os.environ.get('MONGO_DB') else '❌ Missing'}")
print()

print("=== Imports Check ===")
try:
    from services.embeddings import embed_texts
    print("embeddings: ✅ OK")
except Exception as e:
    print(f"embeddings: ❌ {e}")

try:
    from services.faiss_index import search_user_index
    print("faiss_index: ✅ OK")
except Exception as e:
    print(f"faiss_index: ❌ {e}")

try:
    from services.mongo import chunks_collection
    print("mongo: ✅ OK")
except Exception as e:
    print(f"mongo: ❌ {e}")

try:
    import openai
    print("openai: ✅ OK")
except Exception as e:
    print(f"openai: ❌ {e}")

print()
print("=== Test Query ===")
try:
    from services.langchain_rag import query_rag
    import asyncio
    
    async def test():
        result = await query_rag("test-user", "test query", "neutral", [])
        print("Query result:", result)
    
    asyncio.run(test())
except Exception as e:
    print(f"Query test failed: {e}")
    import traceback
    traceback.print_exc()
