from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class Word(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    maram: str
    english: str
    audio_url: Optional[str] = None  # For future MP3 files
    category_id: str

class WordCreate(BaseModel):
    maram: str
    english: str
    audio_url: Optional[str] = None
    category_id: str

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str  # Icon name from expo vector icons
    color: str  # Background color for the category card
    word_count: int = 0

class CategoryCreate(BaseModel):
    name: str
    icon: str
    color: str

class UserProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = "default_user"  # For MVP, single user
    words_learned: List[str] = []  # List of word IDs
    practice_sessions: int = 0
    total_words_practiced: int = 0
    streak_days: int = 0
    last_practice_date: Optional[str] = None
    category_progress: dict = {}  # {category_id: words_learned_count}

class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = "default_user"
    name: str = "Learner"
    avatar_color: str = "#58CC02"
    notifications_enabled: bool = True
    sound_enabled: bool = True
    daily_goal: int = 10  # Words per day

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_color: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    daily_goal: Optional[int] = None

class ProgressUpdate(BaseModel):
    word_id: str
    category_id: str

class SentenceOption(BaseModel):
    text: str
    is_correct: bool

class Sentence(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    maram_full: str  # Full sentence in Maram
    maram_blank: str  # Sentence with blank (use ____ for blank)
    english: str  # English translation
    correct_word: str  # The correct word to fill in
    options: List[str]  # Multiple choice options
    category_id: str

class SentenceCreate(BaseModel):
    maram_full: str
    maram_blank: str
    english: str
    correct_word: str
    options: List[str]
    category_id: str

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Maram Language Learning API"}

# Category Routes
@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find().to_list(100)
    return [Category(**cat) for cat in categories]

@api_router.get("/categories/{category_id}", response_model=Category)
async def get_category(category_id: str):
    category = await db.categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return Category(**category)

@api_router.post("/categories", response_model=Category)
async def create_category(category: CategoryCreate):
    cat_obj = Category(**category.dict())
    await db.categories.insert_one(cat_obj.dict())
    return cat_obj

# Word Routes
@api_router.get("/words", response_model=List[Word])
async def get_words(category_id: Optional[str] = None):
    query = {"category_id": category_id} if category_id else {}
    words = await db.words.find(query).to_list(1000)
    return [Word(**word) for word in words]

@api_router.get("/words/{word_id}", response_model=Word)
async def get_word(word_id: str):
    word = await db.words.find_one({"id": word_id})
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    return Word(**word)

@api_router.post("/words", response_model=Word)
async def create_word(word: WordCreate):
    word_obj = Word(**word.dict())
    await db.words.insert_one(word_obj.dict())
    # Update category word count
    await db.categories.update_one(
        {"id": word.category_id},
        {"$inc": {"word_count": 1}}
    )
    return word_obj

# Progress Routes
@api_router.get("/progress")
async def get_progress():
    progress = await db.progress.find_one({"user_id": "default_user"})
    if not progress:
        # Create default progress
        default_progress = UserProgress()
        await db.progress.insert_one(default_progress.dict())
        return default_progress
    return UserProgress(**progress)

@api_router.post("/progress/learn")
async def mark_word_learned(update: ProgressUpdate):
    progress = await db.progress.find_one({"user_id": "default_user"})
    if not progress:
        progress = UserProgress().dict()
        await db.progress.insert_one(progress)
    
    # Update progress
    today = datetime.now().strftime("%Y-%m-%d")
    
    update_ops = {
        "$addToSet": {"words_learned": update.word_id},
        "$inc": {"total_words_practiced": 1},
        "$set": {"last_practice_date": today}
    }
    
    await db.progress.update_one(
        {"user_id": "default_user"},
        update_ops,
        upsert=True
    )
    
    # Update category progress
    await db.progress.update_one(
        {"user_id": "default_user"},
        {"$inc": {f"category_progress.{update.category_id}": 1}}
    )
    
    # Get updated progress
    updated_progress = await db.progress.find_one({"user_id": "default_user"})
    return UserProgress(**updated_progress)

@api_router.post("/progress/session")
async def complete_practice_session():
    today = datetime.now().strftime("%Y-%m-%d")
    
    progress = await db.progress.find_one({"user_id": "default_user"})
    
    if progress:
        last_date = progress.get("last_practice_date")
        current_streak = progress.get("streak_days", 0)
        
        if last_date == today:
            # Already practiced today, just increment session
            new_streak = current_streak
        elif last_date:
            # Check if yesterday
            from datetime import timedelta
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
            if last_date == yesterday:
                new_streak = current_streak + 1
            else:
                new_streak = 1
        else:
            new_streak = 1
    else:
        new_streak = 1
    
    await db.progress.update_one(
        {"user_id": "default_user"},
        {
            "$inc": {"practice_sessions": 1},
            "$set": {
                "last_practice_date": today,
                "streak_days": new_streak
            }
        },
        upsert=True
    )
    
    updated_progress = await db.progress.find_one({"user_id": "default_user"})
    return UserProgress(**updated_progress)

# Profile Routes
@api_router.get("/profile")
async def get_profile():
    profile = await db.profiles.find_one({"user_id": "default_user"})
    if not profile:
        default_profile = UserProfile()
        await db.profiles.insert_one(default_profile.dict())
        return default_profile
    return UserProfile(**profile)

@api_router.put("/profile")
async def update_profile(update: UserProfileUpdate):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.profiles.update_one(
            {"user_id": "default_user"},
            {"$set": update_data},
            upsert=True
        )
    profile = await db.profiles.find_one({"user_id": "default_user"})
    return UserProfile(**profile)

# Sentence Routes
@api_router.get("/sentences", response_model=List[Sentence])
async def get_sentences(category_id: Optional[str] = None):
    query = {"category_id": category_id} if category_id else {}
    sentences = await db.sentences.find(query).to_list(100)
    return [Sentence(**s) for s in sentences]

@api_router.get("/sentences/{sentence_id}", response_model=Sentence)
async def get_sentence(sentence_id: str):
    sentence = await db.sentences.find_one({"id": sentence_id})
    if not sentence:
        raise HTTPException(status_code=404, detail="Sentence not found")
    return Sentence(**sentence)

@api_router.post("/sentences", response_model=Sentence)
async def create_sentence(sentence: SentenceCreate):
    new_sentence = Sentence(**sentence.dict())
    await db.sentences.insert_one(new_sentence.dict())
    return new_sentence

# Seed Data Route
@api_router.post("/seed")
async def seed_database():
    # Clear existing data
    await db.categories.delete_many({})
    await db.words.delete_many({})
    await db.sentences.delete_many({})
    
    # Categories with vibrant colors and icons
    categories_data = [
        {"name": "Food", "icon": "restaurant", "color": "#FF6B6B"},
        {"name": "Family", "icon": "people", "color": "#4ECDC4"},
        {"name": "Colors", "icon": "color-palette", "color": "#9B59B6"},
        {"name": "Animals", "icon": "paw", "color": "#F39C12"},
        {"name": "Outdoors", "icon": "leaf", "color": "#27AE60"},
        {"name": "Household", "icon": "home", "color": "#3498DB"},
        {"name": "Weather & Time", "icon": "partly-sunny", "color": "#E74C3C"},
        {"name": "Days", "icon": "calendar", "color": "#1ABC9C"},
    ]
    
    # Sample Maram words (placeholder - can be replaced later)
    words_data = {
        "Food": [
            {"maram": "tak", "english": "rice"},
            {"maram": "akaa", "english": "fish"},
            {"maram": "adui", "english": "water"},
            {"maram": "chirrock", "english": "bread"},
            {"maram": "rahtee", "english": "fruit"},
            {"maram": "kamyi", "english": "meat"},
            {"maram": "gainii", "english": "vegetables"},
            {"maram": "alotii", "english": "potatoes"},
        ],
        "Family": [
            {"maram": "apui", "english": "mother"},
            {"maram": "pfii", "english": "father"},
            {"maram": "apou", "english": "uncle"},
            {"maram": "anai", "english": "aunt"},
            {"maram": "snahbuh", "english": "brother"},
            {"maram": "snahpai", "english": "sister"},
            {"maram": "anah", "english": "child"},
            {"maram": "mei", "english": "people"},
        ],
        "Colors": [
            {"maram": "kagahn", "english": "red"},
            {"maram": "mungjai", "english": "blue"},
            {"maram": "madiak", "english": "green"},
            {"maram": "kafii lang", "english": "yellow"},
            {"maram": "katiak", "english": "black"},
            {"maram": "kaha", "english": "white"},
            {"maram": "asah", "english": "color"},
            {"maram": "rabiit", "english": "grey"},
        ],
        "Animals": [
            {"maram": "achinah", "english": "dog"},
            {"maram": "chokpiinah", "english": "cat"},
            {"maram": "tom", "english": "cow"},
            {"maram": "reenah", "english": "bird"},
            {"maram": "arri", "english": "chicken"},
            {"maram": "takoi", "english": "horse"},
            {"maram": "sahrumkounah", "english": "animal (wild)"},
            {"maram": "akouruina", "english": "animal (domestic)"},
            {"maram": "kaleenah", "english": "squirrel"},
            {"maram": "amyii", "english": "goat"},
            {"maram": "abak", "english": "pig"},
        ],
        "Outdoors": [
            {"maram": "emvuh", "english": "river"},
            {"maram": "azung", "english": "mountain"},
            {"maram": "ruibang", "english": "tree"},
            {"maram": "hupa", "english": "flower"},
            {"maram": "rangrii", "english": "earth"},
            {"maram": "akash", "english": "sky"},
            {"maram": "lamek", "english": "sun"},
            {"maram": "sakii", "english": "moon"},
            {"maram": "sagaiti", "english": "star"},
            {"maram": "seting", "english": "heaven"},
        ],
        "Household": [
            {"maram": "akii", "english": "house"},
            {"maram": "tkum", "english": "door"},
            {"maram": "khirki", "english": "window"},
            {"maram": "bamrok", "english": "table"},
            {"maram": "bamrok", "english": "chair"},
            {"maram": "thoume", "english": "lamp"},
            {"maram": "rakche", "english": "utensil"},
            {"maram": "ali", "english": "pot"},
        ],
        "Weather & Time": [
            {"maram": "chiile", "english": "sun/heat"},
            {"maram": "tinruh", "english": "rain"},
            {"maram": "megha", "english": "cloud"},
            {"maram": "tingkai", "english": "wind"},
            {"maram": "tingnai", "english": "day"},
            {"maram": "tingchoi", "english": "morning"},
            {"maram": "tingkii", "english": "night"},
        ],
        "Days": [
            {"maram": "tingnai", "english": "today"},
            {"maram": "indanigh", "english": "yesterday"},
            {"maram": "sopanigh", "english": "tomorrow"},
            {"maram": "sagongkii panai", "english": "Monday"},
            {"maram": "saziimana panai", "english": "Tuesday"},
            {"maram": "kilutchii panai", "english": "Wednesday"},
            {"maram": "tekoi kazung panai", "english": "Thursday"},
            {"maram": "zzrah panai", "english": "Friday"},
            {"maram": "kangchii panai", "english": "Saturday"},
            {"maram": "ma panai", "english": "Sunday"},
        ],
    }
    
    created_categories = []
    created_words = []
    created_sentences = []
    
    # Sample sentences for each category
    sentences_data = {
        "Food": [
            {"maram_full": "Tak chii bi le.", "maram_blank": "____ chii bi le.", "english": "The rice tastes good.", "correct_word": "tak", "options": ["tak", "tingkai", "abakcho"]},
            {"maram_full": "Tingnai ei chi akaa le le.", "maram_blank": "Tingnai ei chi ____ le le.", "english": "I will eat fish today.", "correct_word": "akaa", "options": ["apui", "apou", "akaa"]},
            {"maram_full": "Adui le le.", "maram_blank": "____ le le.", "english": "There is water.", "correct_word": "adui", "options": ["adui", "emvuh", "tak"]},
            {"maram_full": "Chirrock chi le.", "maram_blank": "____ chi le.", "english": "The bread is hot.", "correct_word": "chirrock", "options": ["akaa", "chirrock", "tingnai"]},
        ],
        "Family": [
            {"maram_full": "Apui danke li ke?", "maram_blank": "____ danke li ke?", "english": "Where is Mom?", "correct_word": "apui", "options": ["apui", "takoi", "akaa"]},
            {"maram_full": "Pfii tabaak chi le.", "maram_blank": "____ tabaak chi le.", "english": "Father works.", "correct_word": "pfii", "options": ["tak", "pfii", "megha"]},
            {"maram_full": "Snahle intah le.", "maram_blank": "____ intah le.", "english": "The sisters are happy.", "correct_word": "snahle", "options": ["anah", "snahle", "mei"]},
            {"maram_full": "Halang takle, apou.", "maram_blank": "Halang takle, ____.", "english": "Thank you, uncle.", "correct_word": "apou", "options": ["apou", "kaha", "ahsaw"]},
        ],
        "Colors": [
            {"maram_full": "Hupa kagahn ngou bi le.", "maram_blank": "Hupa ____ ngou bi le.", "english": "The red flower is beautiful.", "correct_word": "kagahn", "options": ["mungjai", "kaha", "kagahn"]},
            {"maram_full": "Paizou mungjai le le.", "maram_blank": "Paizou ____ le le.", "english": "The shirt is blue.", "correct_word": "mungjai", "options": ["rabiit", "tingkai", "mungjai"]},
            {"maram_full": "Rebung madiak kadee le.", "maram_blank": "Rebung ____ kadee le.", "english": "The green tree is big.", "correct_word": "madiak", "options": ["snahle", "madiak", "kafii lang"]},
            {"maram_full": "Achii nah katiak le le.", "maram_blank": "Achii nah ____ le le.", "english": "There is a black dog.", "correct_word": "katiak", "options": ["katiak", "madiak", "ahsaw"]},
        ],
        "Animals": [
            {"maram_full": "Achinah mah ke?", "maram_blank": "____ mah ke.", "english": "Is that a dog?", "correct_word": "achinah", "options": ["achinah", "apou", "abak"]},
            {"maram_full": "Chokpiinah zz le.", "maram_blank": "____ zz le.", "english": "The cat sleeps.", "correct_word": "chokpiinah", "options": ["chokpiinah", "tak", "achinah"]},
            {"maram_full": "Abak-cho gai chi bi makle.", "maram_blank": "____-cho gai chi bi makle.", "english": "The pork curry doesn't taste good.", "correct_word": "abak", "options": ["amyii", "tom", "abak"]},
            {"maram_full": "Ee takoi marei le.", "maram_blank": "E ____ marei le.", "english": "I like horses.", "correct_word": "takoi", "options": ["chokpiinah", "takoi", "amyii"]},
        ],
        "Outdoors": [
            {"maram_full": "Emvuh kachang le le.", "maram_blank": "____ kachang le le.", "english": "The river is small.", "correct_word": "emvuh", "options": ["adui", "emvuh", "ruibang"]},
            {"maram_full": "Nyii azung marei makle.", "maram_blank": "____ azung marei makle.", "english": "We don't like mountains.", "correct_word": "azung", "options": ["rangrii", "akaa", "azung"]},
            {"maram_full": "Tingkii sakii danke li ke?", "maram_blank": "Tingkii ____ danke li ke?", "english": "Where is the moon tonight?", "correct_word": "sakii", "options": ["sakii", "lamek", "seting"]},
            {"maram_full": "Akash mungjai le le.", "maram_blank": "____ mungjai le le.", "english": "The sky is blue.", "correct_word": "akash", "options": ["hupa", "sagaiti", "akash"]},
        ],
        "Household": [
            {"maram_full": "Bamrock bam lo.", "maram_blank": "____ bam lo.", "english": "Sit on the chair.", "correct_word": "bamrock", "options": ["tak", "bamrock", "sakii", "tkum"]},
            {"maram_full": "Akii ngou bi le.", "maram_blank": "____ ngou bi le.", "english": "The house is beautiful.", "correct_word": "akii", "options": ["akii", "apou", "akaa"]},
            {"maram_full": "Tkum kagahn le le.", "maram_blank": "____ kagahn le le.", "english": "The door is red.", "correct_word": "tkum", "options": ["thoume", "tkum", "rakche"]},
            {"maram_full": "Thoume kiloom le le.", "maram_blank": "____ kiloom le le.", "english": "The lamp is inside.", "correct_word": "thoume", "options": ["akii", "kami", "thoume"]},
        ],
        "Weather & Time": [
            {"maram_full": "Sopanigh chi tangle.", "maram_blank": "____ chi tangle.", "english": "Tomorrow it will be hot.", "correct_word": "sopanigh", "options": ["tingnai", "sopanigh", "kizam"]},
            {"maram_full": "Tinruh le le.", "maram_blank": "____ le le.", "english": "It is raining.", "correct_word": "tinruh", "options": ["tinruh", "sakii", "tinchoi"]},
            {"maram_full": "Tinkii touk tai le.", "maram_blank": "____ touk tai le.", "english": "The evening is cold.", "correct_word": "tinkii", "options": ["tinkii", "tingkai", "tingnii"]},
            {"maram_full": "Tingchoi kabi!", "maram_blank": "____ kabi!", "english": "Good morning!", "correct_word": "tingchoi", "options": ["tingnai", "tingchoi", "reibung"]},
        ],
        "Days": [
            {"maram_full": "Tingnai sagongkii panai le le.", "maram_blank": "Tingnai ____ le le.", "english": "Today is Monday.", "correct_word": "sagongkii panai", "options": ["sagongkii panai", "kilutchii panai", "zzrah panai"]},
            {"maram_full": "Ee roy takle indanigh.", "maram_blank": "Ee roy takle ____.", "english": "I went yesterday.", "correct_word": "indanigh", "options": ["tingnai", "indanigh", "sopanigh"]},
            {"maram_full": "Ee zz le kangchii panai.", "maram_blank": "Ee zz le ____.", "english": "I sleep on Saturday.", "correct_word": "kangchii panai", "options": ["kangchii panai", "tekoi kazung panai", "indanigh"]},
            {"maram_full": "Dapai chi ke kilutchii panai?", "maram_blank": "Dapai chi ke ____?", "english": "What do you do on Wednesday?", "correct_word": "kilutchii panai", "options": ["sagongkii panai", "ma panai", "kilutchii panai"]},
        ],
    }
    
    for cat_data in categories_data:
        category = Category(**cat_data, word_count=0)
        await db.categories.insert_one(category.dict())
        created_categories.append(category)
        
        # Add words for this category
        if category.name in words_data:
            for word_data in words_data[category.name]:
                word = Word(**word_data, category_id=category.id)
                await db.words.insert_one(word.dict())
                created_words.append(word)
            
            # Update word count
            await db.categories.update_one(
                {"id": category.id},
                {"$set": {"word_count": len(words_data[category.name])}}
            )
        
        # Add sentences for this category
        if category.name in sentences_data:
            for sentence_data in sentences_data[category.name]:
                sentence = Sentence(**sentence_data, category_id=category.id)
                await db.sentences.insert_one(sentence.dict())
                created_sentences.append(sentence)
    
    return {
        "message": "Database seeded successfully",
        "categories_created": len(created_categories),
        "words_created": len(created_words),
        "sentences_created": len(created_sentences)
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
