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
    parent_id: Optional[str] = None  # For sub-categories
    has_subcategories: bool = False  # Flag to indicate if this category has sub-categories

class CategoryCreate(BaseModel):
    name: str
    icon: str
    color: str
    parent_id: Optional[str] = None

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
async def get_categories(parent_id: Optional[str] = None):
    # If parent_id is provided, get sub-categories
    # If parent_id is None, get only top-level categories (parent_id is null)
    if parent_id:
        query = {"parent_id": parent_id}
    else:
        query = {"$or": [{"parent_id": None}, {"parent_id": {"$exists": False}}]}
    categories = await db.categories.find(query).to_list(100)
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
    
    created_categories = []
    created_words = []
    created_sentences = []
    
    # Main categories with sub-categories
    main_categories = [
        {"name": "Food", "icon": "restaurant", "color": "#FF6B6B", "has_subcategories": True},
        {"name": "People & Family", "icon": "people", "color": "#4ECDC4", "has_subcategories": True},
        {"name": "Colors", "icon": "color-palette", "color": "#9B59B6", "has_subcategories": False},
        {"name": "Animals", "icon": "paw", "color": "#F39C12", "has_subcategories": True},
        {"name": "Nature", "icon": "leaf", "color": "#27AE60", "has_subcategories": False},
        {"name": "Household", "icon": "home", "color": "#3498DB", "has_subcategories": True},
        {"name": "Weather & Time", "icon": "partly-sunny", "color": "#E74C3C", "has_subcategories": True},
        {"name": "Numbers", "icon": "calculator", "color": "#8E44AD", "has_subcategories": False},
        {"name": "Clothing", "icon": "shirt", "color": "#E91E63", "has_subcategories": False},
        {"name": "Places", "icon": "location", "color": "#00BCD4", "has_subcategories": False},
    ]
    
    # Sub-categories for each main category
    sub_categories = {
        "Food": [
            {"name": "Fruit", "icon": "nutrition", "color": "#FF8E8E"},
            {"name": "Vegetables", "icon": "leaf", "color": "#7ED957"},
            {"name": "Meat", "icon": "flame", "color": "#C44536"},
            {"name": "Grains & Rice", "icon": "restaurant", "color": "#D4A373"},
        ],
        "People & Family": [
            {"name": "Immediate Family", "icon": "home", "color": "#5DDBD3"},
            {"name": "Extended Family", "icon": "people", "color": "#36A99F"},
            {"name": "Occupations", "icon": "briefcase", "color": "#2E8B84"},
            {"name": "Parts of Body", "icon": "body", "color": "#FFB5A7"},
        ],
        "Animals": [
            {"name": "Wild Animals", "icon": "paw", "color": "#E67E22"},
            {"name": "Domestic Animals", "icon": "home", "color": "#F5B041"},
            {"name": "Birds", "icon": "egg", "color": "#85C1E9"},
        ],
        "Household": [
            {"name": "Bedroom", "icon": "bed", "color": "#5D9CEC"},
            {"name": "Kitchen", "icon": "restaurant", "color": "#48CFAD"},
            {"name": "Bathroom", "icon": "water", "color": "#4FC1E9"},
        ],
        "Weather & Time": [
            {"name": "Weather", "icon": "cloudy", "color": "#5DADE2"},
            {"name": "Seasons", "icon": "sunny", "color": "#F4D03F"},
            {"name": "Months", "icon": "calendar", "color": "#AF7AC5"},
            {"name": "Days of the Week", "icon": "today", "color": "#45B7D1"},
        ],
    }
    
    # Words for sub-categories
    words_data = {
        # Food sub-categories
        "Fruit": [
            {"maram": "rahtee", "english": "fruit"},
            {"maram": "thaikapee", "english": "banana"},
            {"maram": "thaihii", "english": "mango"},
            {"maram": "thainapai", "english": "pineapple"},
            {"maram": "thaikadee", "english": "papaya"},
            {"maram": "thaikii", "english": "orange"},
        ],
        "Vegetables": [
            {"maram": "gainii", "english": "vegetables"},
            {"maram": "alotii", "english": "potatoes"},
            {"maram": "gaisiinii", "english": "spinach"},
            {"maram": "gainaikang", "english": "cabbage"},
            {"maram": "gaiparou", "english": "pumpkin"},
            {"maram": "gaimung", "english": "beans"},
        ],
        "Meat": [
            {"maram": "kamyi", "english": "meat"},
            {"maram": "akaa", "english": "fish"},
            {"maram": "abakcho", "english": "pork"},
            {"maram": "tomcho", "english": "beef"},
            {"maram": "arricho", "english": "chicken meat"},
            {"maram": "amyiicho", "english": "goat meat"},
        ],
        "Grains & Rice": [
            {"maram": "tak", "english": "rice"},
            {"maram": "chirrock", "english": "bread"},
            {"maram": "adui", "english": "water"},
            {"maram": "takpou", "english": "cooked rice"},
            {"maram": "takrui", "english": "uncooked rice"},
            {"maram": "takkang", "english": "rice flour"},
        ],
        # Family sub-categories
        "Immediate Family": [
            {"maram": "apui", "english": "mother"},
            {"maram": "pfii", "english": "father"},
            {"maram": "snahbuh", "english": "brother"},
            {"maram": "snahpai", "english": "sister"},
            {"maram": "anah", "english": "child"},
            {"maram": "snahle", "english": "siblings"},
        ],
        "Extended Family": [
            {"maram": "apou", "english": "uncle"},
            {"maram": "anai", "english": "aunt"},
            {"maram": "apoupui", "english": "grandmother"},
            {"maram": "apoupfii", "english": "grandfather"},
            {"maram": "snahparou", "english": "cousin"},
            {"maram": "mei", "english": "people"},
        ],
        "Occupations": [
            {"maram": "lounamei", "english": "farmer"},
            {"maram": "tabaaknamei", "english": "worker"},
            {"maram": "zouchinnamei", "english": "teacher"},
            {"maram": "daktornamei", "english": "doctor"},
            {"maram": "soupnamei", "english": "cook"},
            {"maram": "ahsawnamei", "english": "hunter"},
        ],
        "Parts of Body": [
            {"maram": "akhou", "english": "head"},
            {"maram": "ami", "english": "eye"},
            {"maram": "anah", "english": "ear"},
            {"maram": "anui", "english": "nose"},
            {"maram": "ami", "english": "hand"},
            {"maram": "akou", "english": "leg"},
            {"maram": "akham", "english": "mouth"},
        ],
        # Animals sub-categories
        "Wild Animals": [
            {"maram": "sahrumkounah", "english": "wild animal"},
            {"maram": "sakii", "english": "tiger"},
            {"maram": "athom", "english": "bear"},
            {"maram": "akou", "english": "elephant"},
            {"maram": "asau", "english": "deer"},
            {"maram": "kaleenah", "english": "squirrel"},
        ],
        "Domestic Animals": [
            {"maram": "akouruina", "english": "domestic animal"},
            {"maram": "achinah", "english": "dog"},
            {"maram": "chokpiinah", "english": "cat"},
            {"maram": "tom", "english": "cow"},
            {"maram": "takoi", "english": "horse"},
            {"maram": "amyii", "english": "goat"},
            {"maram": "abak", "english": "pig"},
        ],
        "Birds": [
            {"maram": "reenah", "english": "bird"},
            {"maram": "arri", "english": "chicken"},
            {"maram": "avu", "english": "crow"},
            {"maram": "avoknah", "english": "sparrow"},
            {"maram": "atuk", "english": "owl"},
            {"maram": "apui", "english": "eagle"},
        ],
        # Weather & Time sub-categories
        "Weather": [
            {"maram": "chiile", "english": "sun/heat"},
            {"maram": "tinruh", "english": "rain"},
            {"maram": "megha", "english": "cloud"},
            {"maram": "tingkai", "english": "wind"},
            {"maram": "touk", "english": "cold"},
            {"maram": "chi", "english": "hot"},
        ],
        "Seasons": [
            {"maram": "ruitouk", "english": "winter"},
            {"maram": "ruichi", "english": "summer"},
            {"maram": "ruitinruh", "english": "rainy season"},
            {"maram": "ruihupa", "english": "spring"},
        ],
        "Months": [
            {"maram": "thakii", "english": "January"},
            {"maram": "thazii", "english": "February"},
            {"maram": "thasum", "english": "March"},
            {"maram": "thamii", "english": "April"},
            {"maram": "thanga", "english": "May"},
            {"maram": "tharuk", "english": "June"},
        ],
        "Days of the Week": [
            {"maram": "sagongkii panai", "english": "Monday"},
            {"maram": "saziimana panai", "english": "Tuesday"},
            {"maram": "kilutchii panai", "english": "Wednesday"},
            {"maram": "tekoi kazung panai", "english": "Thursday"},
            {"maram": "zzrah panai", "english": "Friday"},
            {"maram": "kangchii panai", "english": "Saturday"},
            {"maram": "ma panai", "english": "Sunday"},
        ],
        # Categories without sub-categories (keep existing words)
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
        "Nature": [
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
        # Household sub-categories
        "Bedroom": [
            {"maram": "zungkii", "english": "bedroom"},
            {"maram": "bistar", "english": "bed"},
            {"maram": "takrou", "english": "pillow"},
            {"maram": "kambal", "english": "blanket"},
            {"maram": "almari", "english": "wardrobe"},
            {"maram": "darpan", "english": "mirror"},
        ],
        "Kitchen": [
            {"maram": "soupkii", "english": "kitchen"},
            {"maram": "ali", "english": "pot"},
            {"maram": "rakche", "english": "utensil"},
            {"maram": "chula", "english": "stove"},
            {"maram": "thali", "english": "plate"},
            {"maram": "gilash", "english": "glass"},
        ],
        "Bathroom": [
            {"maram": "nahkii", "english": "bathroom"},
            {"maram": "adui", "english": "water"},
            {"maram": "sabun", "english": "soap"},
            {"maram": "tauliya", "english": "towel"},
            {"maram": "danta", "english": "toothbrush"},
            {"maram": "shampoo", "english": "shampoo"},
        ],
        # New categories
        "Numbers": [
            {"maram": "akhat", "english": "one"},
            {"maram": "ani", "english": "two"},
            {"maram": "ahum", "english": "three"},
            {"maram": "mali", "english": "four"},
            {"maram": "manga", "english": "five"},
            {"maram": "taruk", "english": "six"},
            {"maram": "tharit", "english": "seven"},
            {"maram": "tachat", "english": "eight"},
            {"maram": "takhou", "english": "nine"},
            {"maram": "tara", "english": "ten"},
        ],
        "Clothing": [
            {"maram": "paizou", "english": "shirt"},
            {"maram": "panjii", "english": "pants"},
            {"maram": "mekhala", "english": "skirt"},
            {"maram": "sapatu", "english": "shoes"},
            {"maram": "topi", "english": "hat"},
            {"maram": "moza", "english": "socks"},
            {"maram": "jacket", "english": "jacket"},
            {"maram": "belt", "english": "belt"},
        ],
        "Places": [
            {"maram": "akii", "english": "house"},
            {"maram": "bazaar", "english": "market"},
            {"maram": "iskul", "english": "school"},
            {"maram": "hospital", "english": "hospital"},
            {"maram": "girja", "english": "church"},
            {"maram": "khet", "english": "field"},
            {"maram": "nadi", "english": "river"},
            {"maram": "gaon", "english": "village"},
        ],
    }
    
    # Sentences for main categories only (as requested)
    sentences_data = {
        "Food": [
            {"maram_full": "Tak chii bi le.", "maram_blank": "____ chii bi le.", "english": "The rice tastes good.", "correct_word": "tak", "options": ["tak", "tingkai", "abakcho"]},
            {"maram_full": "Tingnai ei chi akaa le le.", "maram_blank": "Tingnai ei chi ____ le le.", "english": "I will eat fish today.", "correct_word": "akaa", "options": ["apui", "apou", "akaa"]},
            {"maram_full": "Adui le le.", "maram_blank": "____ le le.", "english": "There is water.", "correct_word": "adui", "options": ["adui", "emvuh", "tak"]},
            {"maram_full": "Chirrock chi le.", "maram_blank": "____ chi le.", "english": "The bread is hot.", "correct_word": "chirrock", "options": ["akaa", "chirrock", "tingnai"]},
        ],
        "People & Family": [
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
        "Nature": [
            {"maram_full": "Emvuh kachang le le.", "maram_blank": "____ kachang le le.", "english": "The river is small.", "correct_word": "emvuh", "options": ["adui", "emvuh", "ruibang"]},
            {"maram_full": "Nyii azung marei makle.", "maram_blank": "____ azung marei makle.", "english": "We don't like mountains.", "correct_word": "azung", "options": ["rangrii", "akaa", "azung"]},
            {"maram_full": "Tingkii sakii danke li ke?", "maram_blank": "Tingkii ____ danke li ke?", "english": "Where is the moon tonight?", "correct_word": "sakii", "options": ["sakii", "lamek", "seting"]},
            {"maram_full": "Akash mungjai le le.", "maram_blank": "____ mungjai le le.", "english": "The sky is blue.", "correct_word": "akash", "options": ["hupa", "sagaiti", "akash"]},
        ],
        "Household": [
            {"maram_full": "Bistar bam lo.", "maram_blank": "____ bam lo.", "english": "Lie on the bed.", "correct_word": "bistar", "options": ["tak", "bistar", "sakii", "tkum"]},
            {"maram_full": "Akii ngou bi le.", "maram_blank": "____ ngou bi le.", "english": "The house is beautiful.", "correct_word": "akii", "options": ["akii", "apou", "akaa"]},
            {"maram_full": "Ali chi le.", "maram_blank": "____ chi le.", "english": "The pot is hot.", "correct_word": "ali", "options": ["thoume", "ali", "rakche"]},
            {"maram_full": "Thoume kiloom le le.", "maram_blank": "____ kiloom le le.", "english": "The lamp is inside.", "correct_word": "thoume", "options": ["akii", "kami", "thoume"]},
        ],
        "Weather & Time": [
            {"maram_full": "Sopanigh chi tangle.", "maram_blank": "____ chi tangle.", "english": "Tomorrow it will be hot.", "correct_word": "sopanigh", "options": ["tingnai", "sopanigh", "kizam"]},
            {"maram_full": "Tinruh le le.", "maram_blank": "____ le le.", "english": "It is raining.", "correct_word": "tinruh", "options": ["tinruh", "sakii", "tinchoi"]},
            {"maram_full": "Tinkii touk tai le.", "maram_blank": "____ touk tai le.", "english": "The evening is cold.", "correct_word": "tinkii", "options": ["tinkii", "tingkai", "tingnii"]},
            {"maram_full": "Tingchoi kabi!", "maram_blank": "____ kabi!", "english": "Good morning!", "correct_word": "tingchoi", "options": ["tingnai", "tingchoi", "reibung"]},
        ],
        "Numbers": [
            {"maram_full": "Akhat mei le le.", "maram_blank": "____ mei le le.", "english": "There is one person.", "correct_word": "akhat", "options": ["akhat", "ani", "ahum"]},
            {"maram_full": "Ani achinah le le.", "maram_blank": "____ achinah le le.", "english": "There are two dogs.", "correct_word": "ani", "options": ["mali", "ani", "tara"]},
            {"maram_full": "Manga thaikii le le.", "maram_blank": "____ thaikii le le.", "english": "There are five oranges.", "correct_word": "manga", "options": ["ahum", "manga", "taruk"]},
            {"maram_full": "Tara tak le le.", "maram_blank": "____ tak le le.", "english": "There are ten rice grains.", "correct_word": "tara", "options": ["tara", "takhou", "tachat"]},
        ],
        "Clothing": [
            {"maram_full": "Paizou kaha le le.", "maram_blank": "____ kaha le le.", "english": "The shirt is white.", "correct_word": "paizou", "options": ["panjii", "paizou", "sapatu"]},
            {"maram_full": "Sapatu katiak le le.", "maram_blank": "____ katiak le le.", "english": "The shoes are black.", "correct_word": "sapatu", "options": ["topi", "moza", "sapatu"]},
            {"maram_full": "Topi kagahn le le.", "maram_blank": "____ kagahn le le.", "english": "The hat is red.", "correct_word": "topi", "options": ["jacket", "topi", "belt"]},
            {"maram_full": "Panjii mungjai le le.", "maram_blank": "____ mungjai le le.", "english": "The pants are blue.", "correct_word": "panjii", "options": ["panjii", "mekhala", "moza"]},
        ],
        "Places": [
            {"maram_full": "Iskul danke li ke?", "maram_blank": "____ danke li ke?", "english": "Where is the school?", "correct_word": "iskul", "options": ["bazaar", "iskul", "hospital"]},
            {"maram_full": "Bazaar kadee le.", "maram_blank": "____ kadee le.", "english": "The market is big.", "correct_word": "bazaar", "options": ["akii", "bazaar", "girja"]},
            {"maram_full": "Hospital kiloom le le.", "maram_blank": "____ kiloom le le.", "english": "The hospital is inside.", "correct_word": "hospital", "options": ["khet", "hospital", "gaon"]},
            {"maram_full": "Gaon ngou bi le.", "maram_blank": "____ ngou bi le.", "english": "The village is beautiful.", "correct_word": "gaon", "options": ["nadi", "gaon", "akii"]},
        ],
    }
    
    # Create main categories first
    category_map = {}  # Map name to category object
    
    for cat_data in main_categories:
        category = Category(**cat_data, word_count=0, parent_id=None)
        await db.categories.insert_one(category.dict())
        created_categories.append(category)
        category_map[category.name] = category
        
        # Add sentences for main categories
        if category.name in sentences_data:
            for sentence_data in sentences_data[category.name]:
                sentence = Sentence(**sentence_data, category_id=category.id)
                await db.sentences.insert_one(sentence.dict())
                created_sentences.append(sentence)
    
    # Create sub-categories and add words
    for parent_name, sub_cats in sub_categories.items():
        parent_category = category_map.get(parent_name)
        if not parent_category:
            continue
            
        for sub_cat_data in sub_cats:
            sub_category = Category(
                **sub_cat_data,
                parent_id=parent_category.id,
                word_count=0,
                has_subcategories=False
            )
            await db.categories.insert_one(sub_category.dict())
            created_categories.append(sub_category)
            
            # Add words for this sub-category
            if sub_category.name in words_data:
                word_count = 0
                for word_data in words_data[sub_category.name]:
                    word = Word(**word_data, category_id=sub_category.id)
                    await db.words.insert_one(word.dict())
                    created_words.append(word)
                    word_count += 1
                
                # Update word count
                await db.categories.update_one(
                    {"id": sub_category.id},
                    {"$set": {"word_count": word_count}}
                )
    
    # Add words for categories without sub-categories
    for cat_name in ["Colors", "Nature", "Numbers", "Clothing", "Places"]:
        category = category_map.get(cat_name)
        if category and cat_name in words_data:
            word_count = 0
            for word_data in words_data[cat_name]:
                word = Word(**word_data, category_id=category.id)
                await db.words.insert_one(word.dict())
                created_words.append(word)
                word_count += 1
            
            # Update word count
            await db.categories.update_one(
                {"id": category.id},
                {"$set": {"word_count": word_count}}
            )
    
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
