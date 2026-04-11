"""
기존 JSON DB → SQLite 마이그레이션 스크립트
실행: python3 migrate.py
"""
import json, sqlite3, uuid
from pathlib import Path

HOME = Path.home()
DB_PATH = HOME / "projects/spagenio/travel-platform/data/travellog.db"
JSON_PATH = HOME / "projects/spagenio/travel-platform/backend/data/travel-sns-db.json"

if not JSON_PATH.exists():
    print("JSON DB 파일이 없습니다. 마이그레이션 건너뜁니다.")
    exit(0)

with open(JSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

conn = sqlite3.connect(str(DB_PATH))
conn.execute("PRAGMA journal_mode=WAL")

# Users
users = data.get("users", [])
migrated = 0
for u in users:
    try:
        conn.execute("""
            INSERT OR IGNORE INTO users
            (id, nickname, email, password, profile_image, bio, role, suspended, agree_marketing, visited_countries, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            u.get("id", str(uuid.uuid4())[:12]),
            u.get("nickname", ""),
            u.get("email", ""),
            u.get("password", ""),
            u.get("profileImage", ""),
            u.get("bio", ""),
            u.get("role", "user"),
            1 if u.get("suspended") else 0,
            1 if u.get("agree_marketing") else 0,
            u.get("visitedCountries", 0),
            u.get("createdAt", ""),
        ))
        uid = u.get("id")
        for fid in u.get("followingIds", []):
            conn.execute("INSERT OR IGNORE INTO user_following (user_id, following_id) VALUES (?, ?)", (uid, fid))
        for fid in u.get("followerIds", []):
            conn.execute("INSERT OR IGNORE INTO user_followers (user_id, follower_id) VALUES (?, ?)", (uid, fid))
        migrated += 1
    except Exception as e:
        print(f"  유저 마이그레이션 오류: {e}")

conn.commit()
conn.close()
print(f"✅ 마이그레이션 완료: 유저 {migrated}명")
