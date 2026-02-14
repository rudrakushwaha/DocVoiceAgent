import os
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI")
MONGO_DB = os.environ.get("MONGO_DB")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
chunks_collection = db["chunks"]
