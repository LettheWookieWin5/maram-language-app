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
            {"maram": "nai", "english": "fish"},
            {"maram": "thu", "english": "water"},
            {"maram": "kho", "english": "bread"},
            {"maram": "mei", "english": "fruit"},
            {"maram": "chi", "english": "meat"},
            {"maram": "lam", "english": "vegetables"},
            {"maram": "pho", "english": "soup"},
        ],
        "Family": [
            {"maram": "ama", "english": "mother"},
            {"maram": "apa", "english": "father"},
            {"maram": "nene", "english": "grandmother"},
            {"maram": "tata", "english": "grandfather"},
            {"maram": "aka", "english": "elder brother"},
            {"maram": "ani", "english": "elder sister"},
            {"maram": "zhi", "english": "child"},
            {"maram": "kho", "english": "family"},
        ],
        "Colors": [
            {"maram": "rang", "english": "red"},
            {"maram": "nila", "english": "blue"},
            {"maram": "hari", "english": "green"},
            {"maram": "pila", "english": "yellow"},
            {"maram": "kala", "english": "black"},
            {"maram": "dhala", "english": "white"},
            {"maram": "nargi", "english": "orange"},
            {"maram": "gula", "english": "pink"},
        ],
        "Animals": [
            {"maram": "kuta", "english": "dog"},
            {"maram": "bila", "english": "cat"},
            {"maram": "gai", "english": "cow"},
            {"maram": "chiri", "english": "bird"},
            {"maram": "makhi", "english": "fish"},
            {"maram": "hati", "english": "elephant"},
            {"maram": "sher", "english": "tiger"},
            {"maram": "ghora", "english": "horse"},
        ],
        "Outdoors": [
            {"maram": "pani", "english": "river"},
            {"maram": "pahar", "english": "mountain"},
            {"maram": "gach", "english": "tree"},
            {"maram": "phul", "english": "flower"},
            {"maram": "mati", "english": "earth"},
            {"maram": "akash", "english": "sky"},
            {"maram": "surya", "english": "sun"},
            {"maram": "tara", "english": "star"},
        ],
        "Household": [
            {"maram": "ghar", "english": "house"},
            {"maram": "darwaza", "english": "door"},
            {"maram": "khirki", "english": "window"},
            {"maram": "mez", "english": "table"},
            {"maram": "kursi", "english": "chair"},
            {"maram": "bistar", "english": "bed"},
            {"maram": "diya", "english": "lamp"},
            {"maram": "bartan", "english": "utensil"},
        ],
        "Weather & Time": [
            {"maram": "gham", "english": "sun/heat"},
            {"maram": "brishti", "english": "rain"},
            {"maram": "megha", "english": "cloud"},
            {"maram": "batash", "english": "wind"},
            {"maram": "sheeta", "english": "cold"},
            {"maram": "garam", "english": "hot"},
            {"maram": "subah", "english": "morning"},
            {"maram": "raat", "english": "night"},
        ],
        "Days": [
            {"maram": "aaj", "english": "today"},
            {"maram": "kal", "english": "yesterday/tomorrow"},
            {"maram": "sombar", "english": "Monday"},
            {"maram": "mongolbar", "english": "Tuesday"},
            {"maram": "budhbar", "english": "Wednesday"},
            {"maram": "brihostibar", "english": "Thursday"},
            {"maram": "shukrobar", "english": "Friday"},
            {"maram": "shonibar", "english": "Saturday"},
        ],
    }
    
    created_categories = []
    created_words = []
    created_sentences = []
    
    # Sample sentences for each category
    sentences_data = {
        "Food": [
            {"maram_full": "Tak chii bi le.", "maram_blank": "____ chii bi le.", "english": "The rice tastes good.", "correct_word": "tak", "options": ["tak", "tata", "kursi"]},
            {"maram_full": "Nai mei lo khabo.", "maram_blank": "____ mei lo khabo.", "english": "I will eat fish today.", "correct_word": "nai", "options": ["nai", "ghar", "rang"]},
            {"maram_full": "Thu pani ache.", "maram_blank": "____ pani ache.", "english": "There is water.", "correct_word": "thu", "options": ["thu", "mez", "bila"]},
            {"maram_full": "Kho ta garam.", "maram_blank": "____ ta garam.", "english": "The bread is hot.", "correct_word": "kho", "options": ["kho", "chiri", "darwaza"]},
        ],
        "Family": [
            {"maram_full": "Ama ghar ache.", "maram_blank": "____ ghar ache.", "english": "Mother is at home.", "correct_word": "ama", "options": ["ama", "kursi", "pani"]},
            {"maram_full": "Apa kaam kore.", "maram_blank": "____ kaam kore.", "english": "Father works.", "correct_word": "apa", "options": ["apa", "tak", "megha"]},
            {"maram_full": "Tata boshot ache.", "maram_blank": "____ boshot ache.", "english": "Grandfather is sitting.", "correct_word": "tata", "options": ["tata", "diya", "gai"]},
            {"maram_full": "Zhi khela kore.", "maram_blank": "____ khela kore.", "english": "The child plays.", "correct_word": "zhi", "options": ["zhi", "nila", "batash"]},
        ],
        "Colors": [
            {"maram_full": "Rang phul sundor.", "maram_blank": "____ phul sundor.", "english": "The red flower is beautiful.", "correct_word": "rang", "options": ["rang", "kal", "hati"]},
            {"maram_full": "Nila akash ache.", "maram_blank": "____ akash ache.", "english": "The sky is blue.", "correct_word": "nila", "options": ["nila", "ghar", "chi"]},
            {"maram_full": "Hari gach baro.", "maram_blank": "____ gach baro.", "english": "The green tree is big.", "correct_word": "hari", "options": ["hari", "sombar", "nai"]},
            {"maram_full": "Kala kuta ache.", "maram_blank": "____ kuta ache.", "english": "There is a black dog.", "correct_word": "kala", "options": ["kala", "pho", "surya"]},
        ],
        "Animals": [
            {"maram_full": "Kuta bhonke.", "maram_blank": "____ bhonke.", "english": "The dog barks.", "correct_word": "kuta", "options": ["kuta", "mez", "brishti"]},
            {"maram_full": "Bila ghume.", "maram_blank": "____ ghume.", "english": "The cat sleeps.", "correct_word": "bila", "options": ["bila", "tak", "khirki"]},
            {"maram_full": "Gai dudh dei.", "maram_blank": "____ dudh dei.", "english": "The cow gives milk.", "correct_word": "gai", "options": ["gai", "apa", "nargi"]},
            {"maram_full": "Chiri gaan gai.", "maram_blank": "____ gaan gai.", "english": "The bird sings.", "correct_word": "chiri", "options": ["chiri", "bistar", "sheeta"]},
        ],
        "Outdoors": [
            {"maram_full": "Pani bahiche.", "maram_blank": "____ bahiche.", "english": "The river flows.", "correct_word": "pani", "options": ["pani", "zhi", "kala"]},
            {"maram_full": "Pahar boro.", "maram_blank": "____ boro.", "english": "The mountain is big.", "correct_word": "pahar", "options": ["pahar", "chi", "sombar"]},
            {"maram_full": "Gach uchho.", "maram_blank": "____ uchho.", "english": "The tree is tall.", "correct_word": "gach", "options": ["gach", "darwaza", "nene"]},
            {"maram_full": "Surya uthche.", "maram_blank": "____ uthche.", "english": "The sun is rising.", "correct_word": "surya", "options": ["surya", "bila", "kho"]},
        ],
        "Household": [
            {"maram_full": "Kursi bam lo.", "maram_blank": "____ bam lo.", "english": "Sit on the chair.", "correct_word": "kursi", "options": ["tak", "diya", "shukrobar", "kursi"]},
            {"maram_full": "Ghar sundor.", "maram_blank": "____ sundor.", "english": "The house is beautiful.", "correct_word": "ghar", "options": ["ghar", "rang", "makhi"]},
            {"maram_full": "Darwaza kholo.", "maram_blank": "____ kholo.", "english": "Open the door.", "correct_word": "darwaza", "options": ["darwaza", "nai", "tara"]},
            {"maram_full": "Diya jwalao.", "maram_blank": "____ jwalao.", "english": "Light the lamp.", "correct_word": "diya", "options": ["diya", "ghora", "aaj"]},
        ],
        "Weather & Time": [
            {"maram_full": "Gham uthche.", "maram_blank": "____ uthche.", "english": "The sun is rising.", "correct_word": "gham", "options": ["gham", "kursi", "aka"]},
            {"maram_full": "Brishti porche.", "maram_blank": "____ porche.", "english": "It is raining.", "correct_word": "brishti", "options": ["brishti", "mati", "pila"]},
            {"maram_full": "Batash bahiche.", "maram_blank": "____ bahiche.", "english": "The wind is blowing.", "correct_word": "batash", "options": ["batash", "lam", "sher"]},
            {"maram_full": "Subah holo.", "maram_blank": "____ holo.", "english": "It is morning.", "correct_word": "subah", "options": ["subah", "mei", "dhala"]},
        ],
        "Days": [
            {"maram_full": "Aaj sundor din.", "maram_blank": "____ sundor din.", "english": "Today is a beautiful day.", "correct_word": "aaj", "options": ["aaj", "thu", "hati"]},
            {"maram_full": "Kal ami jabo.", "maram_blank": "____ ami jabo.", "english": "I will go tomorrow.", "correct_word": "kal", "options": ["kal", "phul", "gula"]},
            {"maram_full": "Sombar kaam.", "maram_blank": "____ kaam.", "english": "Work on Monday.", "correct_word": "sombar", "options": ["sombar", "bartan", "kuta"]},
            {"maram_full": "Shukrobar chutti.", "maram_blank": "____ chutti.", "english": "Friday is a holiday.", "correct_word": "shukrobar", "options": ["shukrobar", "megha", "ani"]},
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
