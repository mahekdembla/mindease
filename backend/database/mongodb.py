import os
import logging
from typing import Optional, Any
from dotenv import load_dotenv  # type: ignore # pyrefly: ignore [missing-import]
import pymongo  # type: ignore # pyrefly: ignore [missing-import]
from pymongo import MongoClient  # type: ignore # pyrefly: ignore [missing-import]

# Safe path resolution for .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path=env_path)


ASCENDING = 1

logger = logging.getLogger("mindease.database")

class MongoDBManager:
    """Centralized MongoDB Connection & Collection Manager."""
    
    def __init__(self):
        self.client: Optional[Any] = None
        self.db: Optional[Any] = None
        self._is_connected: bool = False

    def connect_db(self) -> bool:
        """Initialize MongoDB client and verify connectivity."""
        mongodb_uri = os.environ.get("MONGODB_URI")
        db_name = os.environ.get("MINDEASE_DB_NAME", "mindease")

        if not mongodb_uri:
            logger.warning("MONGODB_URI not found in environment. Database operations will fall back gracefully.")
            self._is_connected = False
            return False

        try:
            # Attempt 1: Standard connection (with certifi CA if available)
            client_kwargs = {
                "serverSelectionTimeoutMS": 5000,
                "connectTimeoutMS": 5000
            }
            try:
                import certifi
                client_kwargs["tlsCAFile"] = certifi.where()
            except ImportError:
                pass

            self.client = MongoClient(mongodb_uri, **client_kwargs)
            if self.client is not None:
                self.client.admin.command("ping")
                self.db = self.client[db_name]
                self._is_connected = True
                logger.info(f"Successfully connected to MongoDB database: {db_name}")
                self.ensure_indexes()
                return True
            return False

        except Exception as e:
            logger.warning(f"Initial MongoDB connection failed ({e}). Attempting TLS fallback...")
            try:
                # Attempt 2: TLS Fallback for Windows SSL Store certificate verification issues
                self.client = MongoClient(
                    mongodb_uri,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=5000,
                    tlsAllowInvalidCertificates=True
                )
                if self.client is not None:
                    self.client.admin.command("ping")
                    self.db = self.client[db_name]
                    self._is_connected = True
                    logger.info(f"Successfully connected to MongoDB database (TLS fallback): {db_name}")
                    self.ensure_indexes()
                    return True
                return False
            except Exception as fallback_err:
                logger.error(f"Failed to connect to MongoDB: {type(fallback_err).__name__} - {fallback_err}")
                self._is_connected = False
                self.client = None
                self.db = None
                return False

    def close_db(self):
        """Close MongoDB client connection on shutdown."""
        if self.client is not None:
            self.client.close()
            logger.info("Closed MongoDB connection.")
            self.client = None
            self.db = None
            self._is_connected = False

    def is_connected(self) -> bool:
        return self._is_connected and self.db is not None

    def get_database(self) -> Optional[Any]:
        return self.db

    def get_collection(self, collection_name: str) -> Optional[Any]:
        if self.is_connected() and self.db is not None:
            return self.db[collection_name]
        return None

    @property
    def journal_entries(self) -> Optional[Any]:
        return self.get_collection("journal_entries")

    @property
    def chat_history(self) -> Optional[Any]:
        return self.get_collection("chat_history")

    @property
    def users(self) -> Optional[Any]:
        return self.get_collection("users")

    @property
    def mood_records(self) -> Optional[Any]:
        return self.get_collection("mood_records")

    @property
    def trusted_contacts(self) -> Optional[Any]:
        return self.get_collection("trusted_contacts")

    @property
    def safety_activities(self) -> Optional[Any]:
        return self.get_collection("safety_activities")

    def ensure_indexes(self):
        """Create necessary indexes for performance."""
        db = self.db
        if not self.is_connected() or db is None:
            return

        try:
            # users collection email index
            db.users.create_index([("email", ASCENDING)], unique=True, sparse=True)

            # journal_entries user_id and numeric id index
            db.journal_entries.create_index([("user_id", ASCENDING)])
            db.journal_entries.create_index([("id", ASCENDING)], sparse=True)

            # chat_history user_id and conversation_id index
            db.chat_history.create_index([("user_id", ASCENDING)])
            db.chat_history.create_index([("user_id", ASCENDING), ("conversation_id", ASCENDING)])
            db.chat_history.create_index([("user_id", ASCENDING), ("timestamp", -1)])

            # trusted_contacts, safety_activities, mood_records indexes
            db.trusted_contacts.create_index([("user_id", ASCENDING)])
            db.safety_activities.create_index([("user_id", ASCENDING)])
            db.mood_records.create_index([("user_id", ASCENDING)])
            logger.info("MongoDB indexes verified successfully.")
        except Exception as e:
            logger.warning(f"Could not create indexes: {e}")

    def get_status(self) -> dict:
        """Returns safe connection health status without exposing credentials."""
        if self.is_connected() and self.db is not None:
            return {
                "status": "connected",
                "database": getattr(self.db, "name", "mindease")
            }
        return {
            "status": "disconnected"
        }

# Global database manager instance
db_manager = MongoDBManager()


