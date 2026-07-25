#!/usr/bin/env python3
"""
Backend API Testing for Maram Language Learning App
Tests all backend endpoints according to the test plan
"""

import requests
import json
import sys
from typing import Dict, List, Any

# Get backend URL from frontend env
BACKEND_URL = "https://maram-mvp.preview.emergentagent.com/api"

class MaramAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def test_seed_database(self) -> bool:
        """Test POST /api/seed - Seed database with sample data"""
        try:
            response = self.session.post(f"{self.base_url}/seed")
            
            if response.status_code == 200:
                data = response.json()
                if "categories_created" in data and "words_created" in data:
                    categories_count = data["categories_created"]
                    words_count = data["words_created"]
                    self.log_test("Seed Database", True, 
                                f"Created {categories_count} categories and {words_count} words")
                    return True
                else:
                    self.log_test("Seed Database", False, "Missing expected fields in response")
                    return False
            else:
                self.log_test("Seed Database", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Seed Database", False, f"Exception: {str(e)}")
            return False
    
    def test_get_categories(self) -> List[Dict]:
        """Test GET /api/categories - Should return 8 categories"""
        try:
            response = self.session.get(f"{self.base_url}/categories")
            
            if response.status_code == 200:
                categories = response.json()
                
                if len(categories) == 8:
                    # Verify each category has required fields
                    required_fields = ["id", "name", "icon", "color", "word_count"]
                    all_valid = True
                    
                    for cat in categories:
                        for field in required_fields:
                            if field not in cat:
                                all_valid = False
                                break
                        if not all_valid:
                            break
                    
                    if all_valid:
                        category_names = [cat["name"] for cat in categories]
                        expected_names = ["Food", "Family", "Colors", "Animals", "Outdoors", "Household", "Weather & Time", "Days"]
                        
                        if all(name in category_names for name in expected_names):
                            self.log_test("Get Categories", True, 
                                        f"Found all 8 expected categories with correct structure")
                            return categories
                        else:
                            self.log_test("Get Categories", False, 
                                        f"Missing expected categories. Found: {category_names}")
                            return []
                    else:
                        self.log_test("Get Categories", False, "Categories missing required fields")
                        return []
                else:
                    self.log_test("Get Categories", False, 
                                f"Expected 8 categories, got {len(categories)}")
                    return []
            else:
                self.log_test("Get Categories", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return []
                
        except Exception as e:
            self.log_test("Get Categories", False, f"Exception: {str(e)}")
            return []
    
    def test_get_words(self, category_id: str = None) -> List[Dict]:
        """Test GET /api/words with optional category filter"""
        try:
            url = f"{self.base_url}/words"
            if category_id:
                url += f"?category_id={category_id}"
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                words = response.json()
                
                if category_id:
                    # Test filtered words
                    if len(words) == 8:
                        # Verify each word has required fields
                        required_fields = ["id", "maram", "english", "audio_url", "category_id"]
                        all_valid = True
                        
                        for word in words:
                            for field in required_fields:
                                if field not in word:
                                    all_valid = False
                                    break
                            # Verify category_id matches
                            if word.get("category_id") != category_id:
                                all_valid = False
                                break
                            if not all_valid:
                                break
                        
                        if all_valid:
                            self.log_test("Get Words by Category", True, 
                                        f"Found 8 words for category {category_id} with correct structure")
                            return words
                        else:
                            self.log_test("Get Words by Category", False, 
                                        "Words missing required fields or wrong category_id")
                            return []
                    else:
                        self.log_test("Get Words by Category", False, 
                                    f"Expected 8 words for category, got {len(words)}")
                        return []
                else:
                    # Test all words
                    if len(words) >= 64:  # Should have at least 64 words (8 categories × 8 words)
                        self.log_test("Get All Words", True, 
                                    f"Found {len(words)} total words")
                        return words
                    else:
                        self.log_test("Get All Words", False, 
                                    f"Expected at least 64 words, got {len(words)}")
                        return []
            else:
                test_name = "Get Words by Category" if category_id else "Get All Words"
                self.log_test(test_name, False, 
                            f"HTTP {response.status_code}: {response.text}")
                return []
                
        except Exception as e:
            test_name = "Get Words by Category" if category_id else "Get All Words"
            self.log_test(test_name, False, f"Exception: {str(e)}")
            return []
    
    def test_get_progress(self) -> Dict:
        """Test GET /api/progress - Should return user progress"""
        try:
            response = self.session.get(f"{self.base_url}/progress")
            
            if response.status_code == 200:
                progress = response.json()
                
                required_fields = ["words_learned", "practice_sessions", "streak_days", "total_words_practiced"]
                all_valid = True
                
                for field in required_fields:
                    if field not in progress:
                        all_valid = False
                        break
                
                if all_valid:
                    self.log_test("Get Progress", True, 
                                f"Progress: {progress['words_learned']} words learned, "
                                f"{progress['practice_sessions']} sessions, "
                                f"{progress['streak_days']} day streak")
                    return progress
                else:
                    self.log_test("Get Progress", False, "Progress missing required fields")
                    return {}
            else:
                self.log_test("Get Progress", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return {}
                
        except Exception as e:
            self.log_test("Get Progress", False, f"Exception: {str(e)}")
            return {}
    
    def test_mark_word_learned(self, word_id: str, category_id: str) -> bool:
        """Test POST /api/progress/learn - Mark a word as learned"""
        try:
            payload = {
                "word_id": word_id,
                "category_id": category_id
            }
            
            response = self.session.post(f"{self.base_url}/progress/learn", 
                                       json=payload)
            
            if response.status_code == 200:
                progress = response.json()
                
                if word_id in progress.get("words_learned", []):
                    self.log_test("Mark Word Learned", True, 
                                f"Successfully marked word {word_id} as learned")
                    return True
                else:
                    self.log_test("Mark Word Learned", False, 
                                f"Word {word_id} not found in learned words list")
                    return False
            else:
                self.log_test("Mark Word Learned", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Mark Word Learned", False, f"Exception: {str(e)}")
            return False
    
    def test_complete_session(self) -> bool:
        """Test POST /api/progress/session - Complete a practice session"""
        try:
            response = self.session.post(f"{self.base_url}/progress/session")
            
            if response.status_code == 200:
                progress = response.json()
                
                if progress.get("practice_sessions", 0) > 0:
                    self.log_test("Complete Session", True, 
                                f"Session completed. Total sessions: {progress['practice_sessions']}")
                    return True
                else:
                    self.log_test("Complete Session", False, 
                                "Practice sessions count not incremented")
                    return False
            else:
                self.log_test("Complete Session", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Complete Session", False, f"Exception: {str(e)}")
            return False
    
    def test_get_profile(self) -> Dict:
        """Test GET /api/profile - Should return user profile"""
        try:
            response = self.session.get(f"{self.base_url}/profile")
            
            if response.status_code == 200:
                profile = response.json()
                
                required_fields = ["name", "avatar_color", "notifications_enabled", "sound_enabled", "daily_goal"]
                all_valid = True
                
                for field in required_fields:
                    if field not in profile:
                        all_valid = False
                        break
                
                if all_valid:
                    self.log_test("Get Profile", True, 
                                f"Profile: {profile['name']}, goal: {profile['daily_goal']} words/day")
                    return profile
                else:
                    self.log_test("Get Profile", False, "Profile missing required fields")
                    return {}
            else:
                self.log_test("Get Profile", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return {}
                
        except Exception as e:
            self.log_test("Get Profile", False, f"Exception: {str(e)}")
            return {}
    
    def test_update_profile(self, new_name: str) -> bool:
        """Test PUT /api/profile - Update profile name"""
        try:
            payload = {"name": new_name}
            
            response = self.session.put(f"{self.base_url}/profile", json=payload)
            
            if response.status_code == 200:
                profile = response.json()
                
                if profile.get("name") == new_name:
                    self.log_test("Update Profile", True, 
                                f"Successfully updated profile name to '{new_name}'")
                    return True
                else:
                    self.log_test("Update Profile", False, 
                                f"Profile name not updated. Expected '{new_name}', got '{profile.get('name')}'")
                    return False
            else:
                self.log_test("Update Profile", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update Profile", False, f"Exception: {str(e)}")
            return False
    
    def run_full_test_suite(self):
        """Run the complete test suite following the specified test flow"""
        print(f"🚀 Starting Maram Language Learning App Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Step 1: Seed the database
        print("\n📦 Step 1: Seeding Database")
        seed_success = self.test_seed_database()
        
        if not seed_success:
            print("❌ Database seeding failed. Cannot continue with tests.")
            return False
        
        # Step 2: Test categories
        print("\n📂 Step 2: Testing Categories API")
        categories = self.test_get_categories()
        
        if not categories:
            print("❌ Categories test failed. Cannot continue with word tests.")
            return False
        
        # Step 3: Test all words
        print("\n📝 Step 3: Testing Words API (All Words)")
        all_words = self.test_get_words()
        
        # Step 4: Test words by category (pick first category)
        print("\n📝 Step 4: Testing Words API (By Category)")
        test_category = categories[0]
        category_words = self.test_get_words(test_category["id"])
        
        if not category_words:
            print("❌ Category words test failed. Cannot continue with progress tests.")
            return False
        
        # Step 5: Test initial progress
        print("\n📊 Step 5: Testing Progress API (Initial State)")
        initial_progress = self.test_get_progress()
        
        # Step 6: Mark a word as learned
        print("\n📚 Step 6: Testing Mark Word as Learned")
        test_word = category_words[0]
        learn_success = self.test_mark_word_learned(test_word["id"], test_word["category_id"])
        
        # Step 7: Complete a practice session
        print("\n🎯 Step 7: Testing Complete Practice Session")
        session_success = self.test_complete_session()
        
        # Step 8: Verify progress increased
        print("\n📈 Step 8: Verifying Progress Increased")
        updated_progress = self.test_get_progress()
        
        if updated_progress and initial_progress:
            words_increased = len(updated_progress.get("words_learned", [])) > len(initial_progress.get("words_learned", []))
            sessions_increased = updated_progress.get("practice_sessions", 0) > initial_progress.get("practice_sessions", 0)
            
            if words_increased and sessions_increased:
                self.log_test("Progress Verification", True, 
                            "Both words learned and practice sessions increased correctly")
            else:
                self.log_test("Progress Verification", False, 
                            f"Progress not updated correctly. Words: {words_increased}, Sessions: {sessions_increased}")
        
        # Step 9: Test profile
        print("\n👤 Step 9: Testing Profile API (Get)")
        initial_profile = self.test_get_profile()
        
        # Step 10: Update profile
        print("\n✏️ Step 10: Testing Profile API (Update)")
        new_name = "Maram Learner Pro"
        update_success = self.test_update_profile(new_name)
        
        # Step 11: Verify profile updated
        print("\n✅ Step 11: Verifying Profile Updated")
        updated_profile = self.test_get_profile()
        
        if updated_profile and updated_profile.get("name") == new_name:
            self.log_test("Profile Update Verification", True, 
                        f"Profile name successfully updated to '{new_name}'")
        else:
            self.log_test("Profile Update Verification", False, 
                        "Profile name was not updated correctly")
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = MaramAPITester()
    success = tester.run_full_test_suite()
    
    if success:
        print("\n🎉 All tests passed! Backend APIs are working correctly.")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed. Check the details above.")
        sys.exit(1)

if __name__ == "__main__":
    main()