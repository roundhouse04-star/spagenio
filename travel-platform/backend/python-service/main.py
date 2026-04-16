from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import smtplib, random, string, os, time, uuid, sqlite3
from pathlib import Path
from contextlib import contextmanager
from io import BytesIO
import shutil
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False

try:
    import jwt as pyjwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

app = FastAPI(title="Travellog Auth API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

GMAIL_USER         = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
SECRET_KEY         = os.getenv("SECRET_KEY", "")
ADMIN_USERNAME     = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD     = os.getenv("ADMIN_PASSWORD", "")
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY 환경변수가 설정되지 않았습니다.")

# ── SQLite DB 경로 (Spring Boot와 동일한 파일 공유) ──────
HOME = Path.home()
DB_PATH = HOME / "projects/spagenio/travel-platform/data/travellog.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

verify_store: dict = {}

# ── 업로드 설정 ──────────────────────────────────────────
UPLOAD_DIR = HOME / "projects/spagenio/travel-platform/uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
BASE_URL = os.getenv("BASE_URL", "https://travel.spagenio.com")
MAX_UPLOAD_SIZE = 30 * 1024 * 1024  # 20MB
MAX_VIDEO_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB
MAX_VIDEO_OUTPUT_SIZE = 50 * 1024 * 1024   # 50MB
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm", "video/3gpp", "video/mpeg"}
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"}

# 이미지 사이즈 설정
IMG_SIZES = {
    "thumb":  (300,  300,  85),   # (width, height, quality)
    "feed":   (800,  800,  85),
    "detail": (1920, 1920, 90),
}

@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                nickname TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                profile_image TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                role TEXT DEFAULT 'user',
                suspended INTEGER DEFAULT 0,
                agree_marketing INTEGER DEFAULT 0,
                visited_countries INTEGER DEFAULT 0,
                nationality TEXT DEFAULT 'KR',
                wish_countries TEXT DEFAULT '[]',
                created_at TEXT,
                last_login TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_following (
                user_id TEXT,
                following_id TEXT,
                PRIMARY KEY (user_id, following_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_followers (
                user_id TEXT,
                follower_id TEXT,
                PRIMARY KEY (user_id, follower_id)
            )
        """)

init_db()

def row_to_user(row, conn=None) -> dict:
    if row is None:
        return None
    u = dict(row)
    u["suspended"] = bool(u.get("suspended", 0))
    u["agreeMarketing"] = bool(u.pop("agree_marketing", 0))
    u["visitedCountries"] = u.pop("visited_countries", 0)
    u["profileImage"] = u.pop("profile_image", "")
    u["createdAt"] = u.pop("created_at", None)
    u["lastLogin"] = u.pop("last_login", None)
    if conn:
        rows = conn.execute("SELECT following_id FROM user_following WHERE user_id=?", (u["id"],)).fetchall()
        u["followingIds"] = [r[0] for r in rows]
        rows = conn.execute("SELECT follower_id FROM user_followers WHERE user_id=?", (u["id"],)).fetchall()
        u["followerIds"] = [r[0] for r in rows]
    return u

def hash_password(password: str) -> str:
    if BCRYPT_AVAILABLE:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    import hashlib
    return hashlib.pbkdf2_hmac("sha256", password.encode(), SECRET_KEY.encode(), 300000).hex()

def verify_password(password: str, hashed: str) -> bool:
    if BCRYPT_AVAILABLE:
        try:
            return bcrypt.checkpw(password.encode(), hashed.encode())
        except:
            return False
    import hashlib
    return hashlib.pbkdf2_hmac("sha256", password.encode(), SECRET_KEY.encode(), 300000).hex() == hashed

def make_token(user_id: str, role: str = "user") -> str:
    payload = {"sub": user_id, "role": role, "iat": int(time.time()), "exp": int(time.time()) + TOKEN_EXPIRE_HOURS * 3600}
    if JWT_AVAILABLE:
        return pyjwt.encode(payload, SECRET_KEY, algorithm="HS256")
    import base64, json as _j, hmac as _h, hashlib as _hash
    h = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    b = base64.urlsafe_b64encode(_j.dumps(payload).encode()).rstrip(b"=").decode()
    s = base64.urlsafe_b64encode(_h.new(SECRET_KEY.encode(), f"{h}.{b}".encode(), _hash.sha256).digest()).rstrip(b"=").decode()
    return f"{h}.{b}.{s}"

def decode_token(token: str) -> dict:
    if JWT_AVAILABLE:
        try:
            return pyjwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(401, "토큰이 만료됐습니다.")
        except:
            raise HTTPException(401, "유효하지 않은 토큰입니다.")
    import base64, json as _j, hmac as _h, hashlib as _hash
    try:
        parts = token.split(".")
        if len(parts) != 3: raise HTTPException(401, "유효하지 않은 토큰입니다.")
        h, b, s = parts
        expected = base64.urlsafe_b64encode(_h.new(SECRET_KEY.encode(), f"{h}.{b}".encode(), _hash.sha256).digest()).rstrip(b"=").decode()
        if s != expected: raise HTTPException(401, "유효하지 않은 토큰입니다.")
        pad = lambda x: x + "=" * (-len(x) % 4)
        payload = _j.loads(base64.urlsafe_b64decode(pad(b)))
        if payload.get("exp", 0) < time.time(): raise HTTPException(401, "토큰이 만료됐습니다.")
        return payload
    except HTTPException: raise
    except: raise HTTPException(401, "유효하지 않은 토큰입니다.")

def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "): raise HTTPException(401, "인증이 필요합니다.")
    return decode_token(authorization[7:])

def require_admin(payload: dict = Depends(get_current_user)):
    if payload.get("role") != "admin": raise HTTPException(403, "관리자 권한이 필요합니다.")
    return payload

def make_code() -> str:
    return "".join(random.choices(string.digits, k=6))

def send_email(to: str, subject: str, html_body: str):
    if not GMAIL_APP_PASSWORD:
        print(f"\n📧 [EMAIL TEST] To: {to} | Subject: {subject}\n")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Travellog <{GMAIL_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
        s.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        s.sendmail(GMAIL_USER, to, msg.as_string())

def code_html(code: str, purpose: str) -> str:
    return f"""<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;">
<div style="background:white;border-radius:20px;padding:36px;border:1px solid #eee;">
<h1 style="color:#4f46e5;">✈ Travellog</h1>
<p style="color:#6b7280;">{purpose}</p>
<div style="background:#eef2ff;border:2px solid #c7d2fe;border-radius:14px;padding:20px;text-align:center;margin:20px 0;">
<span style="font-size:36px;font-weight:900;color:#4f46e5;letter-spacing:8px;">{code}</span>
</div></div></div>"""

class SendCodeReq(BaseModel):
    email: str
    nickname: Optional[str] = None

class RegisterReq(BaseModel):
    nickname: str; email: str; password: str; verifyCode: str
    agree_terms: bool = False; agree_privacy: bool = False; agree_content: bool = False
    agree_location: bool = False; agree_marketing: bool = False
    nationality: str = 'KR'
    wish_countries: str = '[]'

class LoginReq(BaseModel):
    email: str; password: str

class AdminLoginReq(BaseModel):
    username: str; password: str

class ForgotSendReq(BaseModel):
    email: str

class ForgotResetReq(BaseModel):
    email: str; verifyCode: str; newPassword: str

class ChangePwReq(BaseModel):
    verifyCode: str; newPassword: str

class WithdrawReq(BaseModel):
    password: str

class AdminUpdateReq(BaseModel):
    nickname: Optional[str] = None; bio: Optional[str] = None
    role: Optional[str] = None; suspended: Optional[bool] = None

class AdminResetPwReq(BaseModel):
    newPassword: str

# ── 정적 파일 서빙 (/uploads/**) ─────────────────────────
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.get("/")
def root(): return {"status": "ok", "service": "travellog-auth"}

# ── 이미지 업로드 ─────────────────────────────────────────
def resize_to_webp(image_bytes: bytes, max_w: int, max_h: int, quality: int) -> bytes:
    try:
        from PIL import Image
        img = Image.open(BytesIO(image_bytes))
        # EXIF 회전 보정
        try:
            from PIL import ExifTags
            exif = img._getexif()
            if exif:
                for tag, val in exif.items():
                    if ExifTags.TAGS.get(tag) == "Orientation":
                        if val == 3: img = img.rotate(180, expand=True)
                        elif val == 6: img = img.rotate(270, expand=True)
                        elif val == 8: img = img.rotate(90, expand=True)
        except:
            pass
        # RGBA → RGB
        if img.mode in ("RGBA", "P", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        # 비율 유지 리사이즈
        img.thumbnail((max_w, max_h), Image.LANCZOS)
        out = BytesIO()
        img.save(out, format="WEBP", quality=quality, method=6)
        return out.getvalue()
    except Exception as e:
        raise HTTPException(500, f"이미지 변환 실패: {str(e)}")

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    # 타입 검증
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp, heic)")
    # 크기 검증
    image_bytes = await file.read()
    if len(image_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(400, "파일 크기는 30MB 이하여야 합니다.")

    # 날짜별 폴더
    date_dir = time.strftime("%Y/%m/%d")
    save_dir = UPLOAD_DIR / date_dir
    save_dir.mkdir(parents=True, exist_ok=True)

    # 고유 ID
    file_id = str(uuid.uuid4()).replace("-", "")[:16]
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"

    # 원본 저장
    original_path = save_dir / f"{file_id}_original{ext}"
    original_path.write_bytes(image_bytes)

    # 각 사이즈별 WebP 변환 저장
    urls = {"original": f"{BASE_URL}/uploads/{date_dir}/{file_id}_original{ext}"}
    for size_name, (max_w, max_h, quality) in IMG_SIZES.items():
        webp_bytes = resize_to_webp(image_bytes, max_w, max_h, quality)
        webp_path = save_dir / f"{file_id}_{size_name}.webp"
        webp_path.write_bytes(webp_bytes)
        urls[size_name] = f"{BASE_URL}/uploads/{date_dir}/{file_id}_{size_name}.webp"

    return {
        "url": urls["feed"],          # 기본 반환 URL (피드용)
        "thumb": urls["thumb"],
        "feed": urls["feed"],
        "detail": urls["detail"],
        "original": urls["original"],
    }


# ── 동영상 업로드 ────────────────────────────────
@app.post("/api/upload/video")
async def upload_video(file: UploadFile = File(...)):
    import subprocess, shutil
    
    # 타입 검증
    content_type = file.content_type or ""
    if content_type not in ALLOWED_VIDEO_TYPES and not content_type.startswith("video/"):
        raise HTTPException(400, "동영상 파일만 업로드 가능합니다. (MP4, MOV, AVI, WebM)")
    
    # 크기 검증 (500MB)
    video_bytes = await file.read()
    if len(video_bytes) > MAX_VIDEO_UPLOAD_SIZE:
        raise HTTPException(400, "동영상 크기는 500MB 이하여야 합니다.")
    
    # 날짜별 폴더
    date_dir = time.strftime("%Y/%m/%d")
    save_dir = UPLOAD_DIR / date_dir
    save_dir.mkdir(parents=True, exist_ok=True)
    
    # 고유 ID
    file_id = str(uuid.uuid4()).replace("-", "")[:16]
    ext = Path(file.filename).suffix.lower() if file.filename else ".mp4"
    
    # 원본 임시 저장
    temp_path = save_dir / f"{file_id}_temp{ext}"
    temp_path.write_bytes(video_bytes)
    
    # FFmpeg으로 MP4 H.264 720p 변환
    output_path = save_dir / f"{file_id}_video.mp4"
    thumb_path = save_dir / f"{file_id}_thumb.jpg"
    
    try:
        # 동영상 변환 (720p, H.264, AAC, 50MB 이하)
        cmd = [
            "ffmpeg", "-i", str(temp_path),
            "-vf", "scale=-2:720",           # 720p (가로 자동)
            "-c:v", "libx264",                # H.264 코덱
            "-preset", "medium",              # 인코딩 속도/품질 균형
            "-crf", "28",                     # 품질 (낮을수록 좋음, 28은 적당)
            "-c:a", "aac",                    # AAC 오디오
            "-b:a", "128k",                   # 오디오 비트레이트
            "-movflags", "+faststart",        # 웹 스트리밍 최적화
            "-y",                             # 덮어쓰기
            str(output_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            # CRF 높여서 재시도 (더 압축)
            cmd[cmd.index("28")] = "32"
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        # 변환 후 크기 확인, 50MB 초과시 더 압축
        if output_path.exists() and output_path.stat().st_size > MAX_VIDEO_OUTPUT_SIZE:
            cmd[cmd.index("32") if "32" in cmd else cmd.index("28")] = "35"
            subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        # 썸네일 생성 (첫 번째 프레임)
        thumb_cmd = [
            "ffmpeg", "-i", str(output_path),
            "-ss", "00:00:01",                # 1초 시점
            "-vframes", "1",                  # 1프레임
            "-vf", "scale=480:-2",            # 480px 너비
            "-q:v", "3",                      # JPEG 품질
            "-y",
            str(thumb_path)
        ]
        subprocess.run(thumb_cmd, capture_output=True, text=True, timeout=30)
        
        # 동영상 정보 가져오기
        probe_cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format", "-show_streams",
            str(output_path)
        ]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
        duration = 0
        try:
            import json as jsonlib
            probe_data = jsonlib.loads(probe_result.stdout)
            duration = float(probe_data.get("format", {}).get("duration", 0))
        except:
            pass
        
    except subprocess.TimeoutExpired:
        # 임시 파일 정리
        temp_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        raise HTTPException(500, "동영상 변환 시간이 초과되었습니다. 더 짧은 영상을 올려주세요.")
    except Exception as e:
        temp_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        raise HTTPException(500, f"동영상 변환 실패: {str(e)}")
    finally:
        # 임시 원본 삭제
        temp_path.unlink(missing_ok=True)
    
    if not output_path.exists():
        raise HTTPException(500, "동영상 변환에 실패했습니다.")
    
    file_size = output_path.stat().st_size
    
    video_url = f"{BASE_URL}/uploads/{date_dir}/{file_id}_video.mp4"
    thumb_url = f"{BASE_URL}/uploads/{date_dir}/{file_id}_thumb.jpg" if thumb_path.exists() else ""
    
    return {
        "url": video_url,
        "thumb": thumb_url,
        "type": "video",
        "duration": round(duration, 1),
        "size": file_size,
        "originalSize": len(video_bytes),
    }

@app.post("/api/upload/multiple")
async def upload_multiple(files: list[UploadFile] = File(...)):
    if len(files) > 10:
        raise HTTPException(400, "최대 10개까지 업로드 가능합니다.")
    results = []
    for file in files:
        result = await upload_image(file)
        results.append(result)
    return {
        "urls": [r["feed"] for r in results],   # 피드용 URL 목록
        "details": results,
    }


# ── 광고 시스템 API ─────────────────────────────
from pydantic import BaseModel as PydanticBase
import random

class AdCreate(PydanticBase):
    advertiser_id: str = ""
    title: str
    description: str = ""
    image_url: str = ""
    link_url: str
    cta_text: str = "자세히 보기"
    ad_type: str = "feed"
    target_country: str = ""
    target_city: str = ""
    target_style: str = ""
    budget_daily: int = 0
    budget_total: int = 0
    cost_per_click: int = 100
    cost_per_impression: int = 10
    start_date: str = ""
    end_date: str = ""

class AdvertiserCreate(PydanticBase):
    user_id: str = ""
    company_name: str
    contact_email: str
    contact_phone: str = ""
    website: str = ""

@app.post("/api/advertisers")
def create_advertiser(req: AdvertiserCreate):
    with get_db() as conn:
        import uuid
        aid = "adv_" + uuid.uuid4().hex[:12]
        conn.execute("INSERT INTO advertisers (id, user_id, company_name, contact_email, contact_phone, website, status) VALUES (?,?,?,?,?,?,?)",
                     (aid, req.user_id, req.company_name, req.contact_email, req.contact_phone, req.website, 'approved'))
        return {"id": aid, "status": "approved"}

@app.get("/api/advertisers")
def get_advertisers():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM advertisers ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/ads")
def create_ad(req: AdCreate):
    with get_db() as conn:
        c = conn.execute("""INSERT INTO ads (advertiser_id, title, description, image_url, link_url, cta_text, ad_type,
                           target_country, target_city, target_style, budget_daily, budget_total,
                           cost_per_click, cost_per_impression, start_date, end_date, status)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (req.advertiser_id, req.title, req.description, req.image_url, req.link_url, req.cta_text, req.ad_type,
                         req.target_country, req.target_city, req.target_style, req.budget_daily, req.budget_total,
                         req.cost_per_click, req.cost_per_impression, req.start_date, req.end_date, 'pending'))
        return {"id": c.lastrowid, "status": "pending"}

@app.get("/api/ads")
def get_ads(advertiser_id: str = "", status: str = ""):
    with get_db() as conn:
        query = "SELECT * FROM ads WHERE 1=1"
        params = []
        if advertiser_id:
            query += " AND advertiser_id = ?"
            params.append(advertiser_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC"
        rows = conn.execute(query, params).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d['impressions'] = conn.execute("SELECT COUNT(*) FROM ad_impressions WHERE ad_id=?", (d['id'],)).fetchone()[0]
            d['clicks'] = conn.execute("SELECT COUNT(*) FROM ad_clicks WHERE ad_id=?", (d['id'],)).fetchone()[0]
            d['ctr'] = round(d['clicks'] / d['impressions'] * 100, 2) if d['impressions'] > 0 else 0
            result.append(d)
        return result

@app.get("/api/ads/feed")
def get_feed_ad(country: str = "", city: str = "", style: str = "", user_id: str = ""):
    """피드에 표시할 광고 1개 반환"""
    with get_db() as conn:
        today = time.strftime("%Y-%m-%d")
        query = """SELECT * FROM ads WHERE status = 'active'
                   AND (start_date IS NULL OR start_date = '' OR start_date <= ?)
                   AND (end_date IS NULL OR end_date = '' OR end_date >= ?)"""
        params = [today, today]
        rows = conn.execute(query, params).fetchall()
        if not rows:
            return None
        # 타겟 매칭 점수 계산
        scored = []
        for r in rows:
            d = dict(r)
            score = d.get('priority', 0)
            if country and d.get('target_country') and country in d['target_country']:
                score += 3
            if city and d.get('target_city') and city in d['target_city']:
                score += 2
            if style and d.get('target_style') and style in d['target_style']:
                score += 1
            # 예산 확인
            today_spend = conn.execute("SELECT COALESCE(SUM(spend),0) FROM ad_daily_stats WHERE ad_id=? AND date=?", (d['id'], today)).fetchone()[0]
            if d.get('budget_daily', 0) > 0 and today_spend >= d['budget_daily']:
                continue  # 일일 예산 초과
            scored.append((score, d))
        if not scored:
            return None
        # 점수 기반 가중 랜덤 선택
        scored.sort(key=lambda x: -x[0])
        top = scored[:5]
        weights = [s[0] + 1 for s in top]
        selected = random.choices(top, weights=weights, k=1)[0][1]
        # 노출 기록
        conn.execute("INSERT INTO ad_impressions (ad_id, user_id) VALUES (?,?)", (selected['id'], user_id))
        conn.execute("""INSERT INTO ad_daily_stats (ad_id, date, impressions, spend)
                       VALUES (?, ?, 1, ?)
                       ON CONFLICT(ad_id, date) DO UPDATE SET impressions = impressions + 1, spend = spend + ?""",
                    (selected['id'], today, selected.get('cost_per_impression', 10), selected.get('cost_per_impression', 10)))
        return selected

@app.post("/api/ads/{ad_id}/click")
def record_click(ad_id: int, user_id: str = ""):
    with get_db() as conn:
        ad = conn.execute("SELECT * FROM ads WHERE id=?", (ad_id,)).fetchone()
        if not ad:
            raise HTTPException(404, "광고를 찾을 수 없습니다")
        conn.execute("INSERT INTO ad_clicks (ad_id, user_id) VALUES (?,?)", (ad_id, user_id))
        today = time.strftime("%Y-%m-%d")
        cpc = dict(ad).get('cost_per_click', 100)
        conn.execute("""INSERT INTO ad_daily_stats (ad_id, date, clicks, spend)
                       VALUES (?, ?, 1, ?)
                       ON CONFLICT(ad_id, date) DO UPDATE SET clicks = clicks + 1, spend = spend + ?""",
                    (ad_id, today, cpc, cpc))
        return {"status": "ok"}

@app.put("/api/ads/{ad_id}/status")
def update_ad_status(ad_id: int, status: str = "", reject_reason: str = ""):
    with get_db() as conn:
        if status not in ('approved', 'active', 'paused', 'ended', 'rejected', 'draft', 'pending'):
            raise HTTPException(400, "유효하지 않은 상태입니다")
        conn.execute("UPDATE ads SET status=?, reject_reason=?, updated_at=datetime('now') WHERE id=?",
                    (status, reject_reason, ad_id))
        return {"id": ad_id, "status": status}

@app.get("/api/ads/{ad_id}/stats")
def get_ad_stats(ad_id: int):
    with get_db() as conn:
        ad = conn.execute("SELECT * FROM ads WHERE id=?", (ad_id,)).fetchone()
        if not ad:
            raise HTTPException(404, "광고를 찾을 수 없습니다")
        d = dict(ad)
        d['total_impressions'] = conn.execute("SELECT COUNT(*) FROM ad_impressions WHERE ad_id=?", (ad_id,)).fetchone()[0]
        d['total_clicks'] = conn.execute("SELECT COUNT(*) FROM ad_clicks WHERE ad_id=?", (ad_id,)).fetchone()[0]
        d['total_spend'] = conn.execute("SELECT COALESCE(SUM(spend),0) FROM ad_daily_stats WHERE ad_id=?", (ad_id,)).fetchone()[0]
        d['ctr'] = round(d['total_clicks'] / d['total_impressions'] * 100, 2) if d['total_impressions'] > 0 else 0
        d['daily_stats'] = [dict(r) for r in conn.execute("SELECT * FROM ad_daily_stats WHERE ad_id=? ORDER BY date DESC LIMIT 30", (ad_id,)).fetchall()]
        return d


# ── 비즈니스 계정 / 오피셜 배지 API ─────────────────────────
BUSINESS_CATEGORIES = [
    {"key": "restaurant", "icon": "🍽️", "label": "음식점/카페"},
    {"key": "hotel", "icon": "🏨", "label": "숙소"},
    {"key": "tour", "icon": "🎒", "label": "투어/액티비티"},
    {"key": "city", "icon": "🏙️", "label": "도시/관광청"},
    {"key": "transport", "icon": "✈️", "label": "교통/항공"},
    {"key": "shopping", "icon": "🛍️", "label": "쇼핑"},
    {"key": "creator", "icon": "🎬", "label": "크리에이터"},
    {"key": "other", "icon": "📢", "label": "기타"},
]

BADGE_TYPES = {
    "none": {"icon": "", "label": "일반", "color": "#9ca3af"},
    "verified": {"icon": "✓", "label": "인증됨", "color": "#3b82f6"},
    "official": {"icon": "★", "label": "공식", "color": "#f59e0b"},
    "premium": {"icon": "♦", "label": "프리미엄", "color": "#8b5cf6"},
}

@app.get("/api/business/categories")
def get_business_categories():
    return BUSINESS_CATEGORIES

@app.get("/api/business/badges")
def get_badge_types():
    return BADGE_TYPES

@app.post("/api/business/register")
def register_business(
    user_id: str = "",
    category: str = "",
    business_name: str = "",
    business_description: str = "",
    business_phone: str = "",
    business_email: str = "",
    business_website: str = "",
    business_address: str = "",
    business_country: str = "",
    business_city: str = "",
    business_document: str = "",
):
    if not user_id or not category or not business_name:
        raise HTTPException(400, "필수 항목을 입력해주세요 (user_id, category, business_name)")
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM business_accounts WHERE user_id=?", (user_id,)).fetchone()
        if existing:
            raise HTTPException(400, "이미 비즈니스 계정이 등록되어 있습니다")
        conn.execute("""INSERT INTO business_accounts 
            (user_id, category, business_name, business_description, business_phone, 
             business_email, business_website, business_address, business_country, 
             business_city, business_document, status, badge_type)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (user_id, category, business_name, business_description, business_phone,
             business_email, business_website, business_address, business_country,
             business_city, business_document, 'pending', 'none'))
        conn.execute("UPDATE users SET account_type='business', business_category=? WHERE id=?", (category, user_id))
        return {"status": "pending", "message": "비즈니스 계정 심사가 접수되었습니다"}

@app.get("/api/business/{user_id}")
def get_business_account(user_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM business_accounts WHERE user_id=?", (user_id,)).fetchone()
        if not row:
            return None
        return dict(row)

@app.get("/api/business")
def get_all_business_accounts(status: str = ""):
    with get_db() as conn:
        if status:
            rows = conn.execute("SELECT b.*, u.nickname, u.email FROM business_accounts b JOIN users u ON b.user_id = u.id WHERE b.status=? ORDER BY b.created_at DESC", (status,)).fetchall()
        else:
            rows = conn.execute("SELECT b.*, u.nickname, u.email FROM business_accounts b JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC").fetchall()
        return [dict(r) for r in rows]

@app.put("/api/business/{user_id}/approve")
def approve_business(user_id: str, badge_type: str = "verified"):
    with get_db() as conn:
        conn.execute("UPDATE business_accounts SET status='approved', badge_type=?, verified_at=datetime('now'), updated_at=datetime('now') WHERE user_id=?", (badge_type, user_id))
        conn.execute("UPDATE users SET account_type='business', badge_type=? WHERE id=?", (badge_type, user_id))
        return {"status": "approved", "badge_type": badge_type}

@app.put("/api/business/{user_id}/reject")
def reject_business(user_id: str, reason: str = ""):
    with get_db() as conn:
        conn.execute("UPDATE business_accounts SET status='rejected', reject_reason=?, updated_at=datetime('now') WHERE user_id=?", (reason, user_id))
        conn.execute("UPDATE users SET account_type='personal', badge_type='none' WHERE id=?", (user_id,))
        return {"status": "rejected"}

@app.put("/api/business/{user_id}/badge")
def update_badge(user_id: str, badge_type: str = "verified"):
    if badge_type not in BADGE_TYPES:
        raise HTTPException(400, "유효하지 않은 배지 타입입니다")
    with get_db() as conn:
        conn.execute("UPDATE business_accounts SET badge_type=?, updated_at=datetime('now') WHERE user_id=?", (badge_type, user_id))
        conn.execute("UPDATE users SET badge_type=? WHERE id=?", (badge_type, user_id))
        return {"badge_type": badge_type}

@app.put("/api/business/{user_id}/official")
def grant_official(user_id: str):
    with get_db() as conn:
        conn.execute("UPDATE business_accounts SET account_type='official', badge_type='official', status='approved', verified_at=datetime('now'), updated_at=datetime('now') WHERE user_id=?", (user_id,))
        conn.execute("UPDATE users SET account_type='official', badge_type='official' WHERE id=?", (user_id,))
        return {"status": "official", "badge_type": "official"}

@app.get("/api/business/{user_id}/stats")
def get_business_stats(user_id: str):
    with get_db() as conn:
        stats = conn.execute("SELECT * FROM business_stats WHERE user_id=? ORDER BY date DESC LIMIT 30", (user_id,)).fetchall()
        total = conn.execute("""SELECT 
            COALESCE(SUM(profile_views),0) as total_views,
            COALESCE(SUM(post_impressions),0) as total_impressions,
            COALESCE(SUM(link_clicks),0) as total_clicks,
            COALESCE(SUM(followers_gained),0) as total_followers
            FROM business_stats WHERE user_id=?""", (user_id,)).fetchone()
        return {"daily": [dict(r) for r in stats], "total": dict(total)}

@app.post("/api/register/send-code")
def register_send_code(req: SendCodeReq):
    with get_db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE email=?", (req.email,)).fetchone():
            raise HTTPException(400, "이미 사용 중인 이메일입니다.")
        if req.nickname and conn.execute("SELECT 1 FROM users WHERE nickname=?", (req.nickname,)).fetchone():
            raise HTTPException(400, "이미 사용 중인 닉네임입니다.")
    code = make_code()
    verify_store[req.email] = {"code": code, "expires_at": time.time() + 300, "type": "register"}
    send_email(req.email, "[Travellog] 회원가입 이메일 인증코드", code_html(code, "회원가입 이메일 인증"))
    return {"message": "인증코드가 발송됐습니다."}

@app.post("/api/register")
def register(req: RegisterReq):
    if not (req.agree_terms and req.agree_privacy and req.agree_content):
        raise HTTPException(400, "필수 약관에 동의해주세요.")
    store = verify_store.get(req.email)
    if not store or store["type"] != "register": raise HTTPException(400, "인증코드를 먼저 발송해주세요.")
    if time.time() > store["expires_at"]: raise HTTPException(400, "인증코드가 만료됐습니다.")
    if store["code"] != req.verifyCode: raise HTTPException(400, "인증코드가 올바르지 않습니다.")
    pw = req.password
    if len(pw) < 8 or not any(c.isupper() for c in pw) or not any(c.islower() for c in pw) or not any(c.isdigit() for c in pw):
        raise HTTPException(400, "비밀번호는 8자 이상, 대/소문자, 숫자를 포함해야 합니다.")
    user_id = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    with get_db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE email=?", (req.email,)).fetchone():
            raise HTTPException(400, "이미 사용 중인 이메일입니다.")
        if conn.execute("SELECT 1 FROM users WHERE nickname=?", (req.nickname,)).fetchone():
            raise HTTPException(400, "이미 사용 중인 닉네임입니다.")
        conn.execute("""INSERT INTO users (id, nickname, email, password, role, suspended, agree_marketing, nationality, wish_countries, created_at)
                        VALUES (?, ?, ?, ?, 'user', 0, ?, ?, ?, ?)""",
                     (user_id, req.nickname, req.email, hash_password(req.password),
                      1 if req.agree_marketing else 0, req.nationality, req.wish_countries, now))
        # 공식 계정 자동 팔로우
        official_id = "travellog-official"
        official = conn.execute("SELECT id FROM users WHERE id=?", (official_id,)).fetchone()
        if official:
            conn.execute("INSERT OR IGNORE INTO user_following (user_id, following_id) VALUES (?, ?)", (user_id, official_id))
            conn.execute("INSERT OR IGNORE INTO user_followers (user_id, follower_id) VALUES (?, ?)", (official_id, user_id))
    del verify_store[req.email]
    return {"message": "가입이 완료됐습니다.", "userId": user_id}

@app.post("/api/login")
def login(req: LoginReq):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email=?", (req.email,)).fetchone()
        if not row or not verify_password(req.password, row["password"]):
            raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
        if row["suspended"]:
            raise HTTPException(403, "정지된 계정입니다.")
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        conn.execute("UPDATE users SET last_login=? WHERE id=?", (now, row["id"]))
        user = row_to_user(row, conn)
    return {"token": make_token(user["id"], user.get("role", "user")),
            "user": {"id": user["id"], "nickname": user["nickname"],
                     "profileImage": user.get("profileImage", ""), "bio": user.get("bio", ""),
                     "nationality": user.get("nationality", "KR"),
                     "wishCountries": user.get("wish_countries", "[]"),
                     "followingIds": user.get("followingIds", []),
                     "preferredStyles": user.get("preferredStyles", []),
                     "badgeType": user.get("badge_type", "none"),
                     "accountType": user.get("account_type", "personal")}}

@app.post("/api/admin/login")
def admin_login(req: AdminLoginReq):
    if not ADMIN_PASSWORD: raise HTTPException(503, "관리자 비밀번호가 설정되지 않았습니다.")
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(401, "관리자 계정 정보가 올바르지 않습니다.")
    return {"token": make_token("admin", "admin"), "role": "admin"}

@app.post("/api/forgot-password/send-code")
def forgot_send(req: ForgotSendReq):
    with get_db() as conn:
        row = conn.execute("SELECT 1 FROM users WHERE email=?", (req.email,)).fetchone()
    if row:
        code = make_code()
        verify_store[req.email] = {"code": code, "expires_at": time.time() + 300, "type": "forgot"}
        send_email(req.email, "[Travellog] 비밀번호 찾기 인증코드", code_html(code, "비밀번호 찾기"))
    return {"message": "인증코드가 발송됐습니다."}

@app.post("/api/forgot-password/reset")
def forgot_reset(req: ForgotResetReq):
    store = verify_store.get(req.email)
    if not store or store["type"] != "forgot": raise HTTPException(400, "인증코드를 먼저 발송해주세요.")
    if time.time() > store["expires_at"]: raise HTTPException(400, "인증코드가 만료됐습니다.")
    if store["code"] != req.verifyCode: raise HTTPException(400, "인증코드가 올바르지 않습니다.")
    with get_db() as conn:
        conn.execute("UPDATE users SET password=? WHERE email=?", (hash_password(req.newPassword), req.email))
    del verify_store[req.email]
    return {"message": "비밀번호가 변경됐습니다."}

@app.post("/api/change-password/send-code")
def change_pw_send(payload: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute("SELECT email FROM users WHERE id=?", (payload["sub"],)).fetchone()
        if not row: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        email = row["email"]
    code = make_code()
    verify_store[email] = {"code": code, "expires_at": time.time() + 300, "type": "change"}
    send_email(email, "[Travellog] 비밀번호 변경 인증코드", code_html(code, "비밀번호 변경"))
    return {"message": "인증코드가 발송됐습니다."}

@app.post("/api/change-password")
def change_pw(req: ChangePwReq, payload: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute("SELECT email FROM users WHERE id=?", (payload["sub"],)).fetchone()
        if not row: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        email = row["email"]
        store = verify_store.get(email)
        if not store or store["type"] != "change": raise HTTPException(400, "인증코드를 먼저 발송해주세요.")
        if time.time() > store["expires_at"]: raise HTTPException(400, "인증코드가 만료됐습니다.")
        if store["code"] != req.verifyCode: raise HTTPException(400, "인증코드가 올바르지 않습니다.")
        conn.execute("UPDATE users SET password=? WHERE id=?", (hash_password(req.newPassword), payload["sub"]))
    del verify_store[email]
    return {"message": "비밀번호가 변경됐습니다."}

@app.post("/api/withdraw")
def withdraw(req: WithdrawReq, payload: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (payload["sub"],)).fetchone()
        if not row: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        if not verify_password(req.password, row["password"]): raise HTTPException(401, "비밀번호가 올바르지 않습니다.")
        conn.execute("DELETE FROM users WHERE id=?", (payload["sub"],))
    return {"message": "탈퇴가 완료됐습니다."}

@app.get("/api/me")
def get_me(payload: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (payload["sub"],)).fetchone()
        if not row: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        user = row_to_user(row, conn)
    return {"id": user["id"], "nickname": user["nickname"], "email": user["email"],
            "profileImage": user.get("profileImage", ""), "bio": user.get("bio", ""),
            "followingIds": user.get("followingIds", []),
            "preferredStyles": user.get("preferredStyles", []),
            "badgeType": user.get("badge_type", "none")}

@app.get("/api/admin/users")
def admin_get_users(page: int = 1, limit: int = 20, search: str = "", payload: dict = Depends(require_admin)):
    with get_db() as conn:
        if search:
            s = f"%{search}%"
            rows = conn.execute("SELECT * FROM users WHERE nickname LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                                (s, s, limit, (page-1)*limit)).fetchall()
            total = conn.execute("SELECT COUNT(*) FROM users WHERE nickname LIKE ? OR email LIKE ?", (s, s)).fetchone()[0]
        else:
            rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
                                (limit, (page-1)*limit)).fetchall()
            total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        users = [row_to_user(r, conn) for r in rows]
    for u in users:
        u.pop("password", None)
    return {"total": total, "page": page, "limit": limit, "users": users}

@app.get("/api/admin/users/{user_id}")
def admin_get_user(user_id: str, payload: dict = Depends(require_admin)):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not row: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        user = row_to_user(row, conn)
    user.pop("password", None)
    return user

@app.patch("/api/admin/users/{user_id}")
def admin_update_user(user_id: str, req: AdminUpdateReq, payload: dict = Depends(require_admin)):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not row: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        if req.nickname is not None: conn.execute("UPDATE users SET nickname=? WHERE id=?", (req.nickname, user_id))
        if req.bio is not None: conn.execute("UPDATE users SET bio=? WHERE id=?", (req.bio, user_id))
        if req.role is not None: conn.execute("UPDATE users SET role=? WHERE id=?", (req.role, user_id))
        if req.suspended is not None: conn.execute("UPDATE users SET suspended=? WHERE id=?", (1 if req.suspended else 0, user_id))
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        user = row_to_user(row, conn)
    user.pop("password", None)
    return user

@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_pw(user_id: str, req: AdminResetPwReq, payload: dict = Depends(require_admin)):
    with get_db() as conn:
        if not conn.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        conn.execute("UPDATE users SET password=? WHERE id=?", (hash_password(req.newPassword), user_id))
    return {"message": "비밀번호가 초기화됐습니다."}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: str, payload: dict = Depends(require_admin)):
    with get_db() as conn:
        if not conn.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        conn.execute("DELETE FROM users WHERE id=?", (user_id,))
    return {"message": "삭제됐습니다."}

@app.get("/api/admin/stats")
def admin_stats(payload: dict = Depends(require_admin)):
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        suspended = conn.execute("SELECT COUNT(*) FROM users WHERE suspended=1").fetchone()[0]
        now = int(time.time())
        today = conn.execute("SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-1 day')").fetchone()[0]
        week = conn.execute("SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-7 days')").fetchone()[0]
        marketing = conn.execute("SELECT COUNT(*) FROM users WHERE agree_marketing=1").fetchone()[0]
    return {"total_users": total, "suspended_users": suspended, "today_joined": today,
            "week_joined": week, "marketing_agree": marketing}

# ── 알림 API ──
import uuid as uuid_lib
from datetime import datetime as dt_now

@app.get("/api/notifications")
async def get_notifications(userId: str, unreadOnly: bool = False):
    with get_db() as conn:
        query = "SELECT id, user_id, actor_id, actor_nickname, actor_profile_image, type, post_id, post_title, message, is_read, created_at FROM notifications WHERE user_id=?"
        params = [userId]
        if unreadOnly:
            query += " AND is_read=0"
        query += " ORDER BY created_at DESC LIMIT 50"
        rows = conn.execute(query, params).fetchall()
        return [{
            "id": r[0], "userId": r[1], "actorId": r[2], "actorNickname": r[3],
            "actorProfileImage": r[4], "type": r[5], "postId": r[6], "postTitle": r[7],
            "message": r[8], "isRead": bool(r[9]), "createdAt": r[10]
        } for r in rows]

def save_notification(user_id, actor_id, actor_nickname, type_, post_id="", post_title="", message=""):
    """알림 DB에 저장 (백그라운드 사용)"""
    if not user_id or user_id == actor_id:
        return
    try:
        nid = uuid_lib.uuid4().hex[:16]
        with get_db() as conn:
            conn.execute("""INSERT INTO notifications (id, user_id, actor_id, actor_nickname, actor_profile_image, type, post_id, post_title, message, is_read, created_at)
                            VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, 0, ?)""",
                         (nid, user_id, actor_id, actor_nickname, type_, post_id, post_title, message, dt_now.now().isoformat()))
            conn.commit()
    except Exception as e:
        print(f"알림 저장 실패: {e}")

@app.post("/api/notifications")
async def create_notification(req: Request):
    data = await req.json()
    nid = uuid_lib.uuid4().hex[:16]
    with get_db() as conn:
        conn.execute("""INSERT INTO notifications (id, user_id, actor_id, actor_nickname, actor_profile_image, type, post_id, post_title, message, is_read, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                     (nid, data.get("userId"), data.get("actorId"), data.get("actorNickname", ""),
                      data.get("actorProfileImage", ""), data.get("type"), data.get("postId", ""),
                      data.get("postTitle", ""), data.get("message", ""), dt_now.now().isoformat()))
        conn.commit()
    return {"ok": True, "id": nid}

@app.post("/api/notifications/{notif_id}/read")
async def mark_read(notif_id: str):
    with get_db() as conn:
        conn.execute("UPDATE notifications SET is_read=1 WHERE id=?", (notif_id,))
        conn.commit()
    return {"ok": True}

@app.post("/api/notifications/read-all")
async def mark_all_read(userId: str = None, req: Request = None):
    if not userId and req:
        try:
            data = await req.json()
            userId = data.get("userId")
        except Exception:
            pass
    if not userId:
        return {"ok": False, "error": "userId required"}
    with get_db() as conn:
        conn.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (userId,))
        conn.commit()
    return {"ok": True}

@app.get("/api/notifications/unread-count")
async def unread_count(userId: str):
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0", (userId,)).fetchone()
        return {"count": row[0] if row else 0}

# ── DM 메시지 API ──
def get_conversation(user1, user2):
    """두 유저 간 대화방 찾기 (없으면 생성)"""
    u1, u2 = sorted([user1, user2])
    with get_db() as conn:
        row = conn.execute("SELECT id FROM dm_conversations WHERE user1_id=? AND user2_id=?", (u1, u2)).fetchone()
        if row:
            return row[0]
        cid = uuid_lib.uuid4().hex[:16]
        conn.execute("""INSERT INTO dm_conversations (id, user1_id, user2_id, last_message_at, created_at)
                        VALUES (?, ?, ?, ?, ?)""",
                     (cid, u1, u2, dt_now.now().isoformat(), dt_now.now().isoformat()))
        conn.commit()
        return cid

@app.get("/api/dm/conversations")
async def list_conversations(userId: str):
    """내 대화방 목록 - 상대 정보 + 최근 메시지 + 안읽음 수"""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT c.id, c.user1_id, c.user2_id, c.last_message, c.last_message_at,
                   c.user1_unread, c.user2_unread,
                   u1.nickname, u1.profile_image,
                   u2.nickname, u2.profile_image
            FROM dm_conversations c
            LEFT JOIN users u1 ON u1.id = c.user1_id
            LEFT JOIN users u2 ON u2.id = c.user2_id
            WHERE c.user1_id=? OR c.user2_id=?
            ORDER BY c.last_message_at DESC
        """, (userId, userId)).fetchall()
        result = []
        for r in rows:
            is_u1 = r[1] == userId
            other_id = r[2] if is_u1 else r[1]
            other_nick = r[9] if is_u1 else r[7]
            other_img = r[10] if is_u1 else r[8]
            unread = r[5] if is_u1 else r[6]
            result.append({
                "id": r[0],
                "otherUserId": other_id,
                "otherNickname": other_nick or "",
                "otherProfileImage": other_img or "",
                "lastMessage": r[3] or "",
                "lastMessageAt": r[4],
                "unreadCount": unread or 0,
            })
        return result

@app.get("/api/dm/conversations/{conv_id}/messages")
async def get_messages(conv_id: str, limit: int = 50):
    """대화방 메시지 목록 (최신순)"""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, conversation_id, sender_id, content, created_at, is_read
            FROM dm_messages
            WHERE conversation_id=?
            ORDER BY created_at ASC
            LIMIT ?
        """, (conv_id, limit)).fetchall()
        return [{
            "id": r[0], "conversationId": r[1], "senderId": r[2],
            "content": r[3], "createdAt": r[4], "isRead": bool(r[5])
        } for r in rows]

@app.post("/api/dm/send")
async def send_message(req: Request):
    """메시지 전송"""
    data = await req.json()
    sender_id = data.get("senderId")
    receiver_id = data.get("receiverId")
    content = data.get("content", "").strip()
    if not sender_id or not receiver_id or not content:
        return {"ok": False, "error": "missing_fields"}
    conv_id = get_conversation(sender_id, receiver_id)
    msg_id = uuid_lib.uuid4().hex[:16]
    now = dt_now.now().isoformat()
    with get_db() as conn:
        # 메시지 저장
        conn.execute("""INSERT INTO dm_messages (id, conversation_id, sender_id, content, created_at, is_read)
                        VALUES (?, ?, ?, ?, ?, 0)""",
                     (msg_id, conv_id, sender_id, content, now))
        # 대화방 업데이트 (수신자의 unread +1)
        u1, u2 = sorted([sender_id, receiver_id])
        if receiver_id == u1:
            conn.execute("UPDATE dm_conversations SET last_message=?, last_message_at=?, user1_unread=user1_unread+1 WHERE id=?",
                         (content, now, conv_id))
        else:
            conn.execute("UPDATE dm_conversations SET last_message=?, last_message_at=?, user2_unread=user2_unread+1 WHERE id=?",
                         (content, now, conv_id))
        # 발송자 닉네임
        sender = conn.execute("SELECT nickname FROM users WHERE id=?", (sender_id,)).fetchone()
        sender_nick = sender[0] if sender else "누군가"
        # 수신자 푸시 토큰
        receiver = conn.execute("SELECT push_token, push_consent FROM users WHERE id=?", (receiver_id,)).fetchone()
        conn.commit()
    # 알림 저장
    save_notification(receiver_id, sender_id, sender_nick, "message", conv_id, "", f"메시지: {content[:30]}")
    # 푸시 전송
    if receiver and receiver[0] and receiver[1] == 1:
        try:
            message = json.dumps({"to": receiver[0], "sound": "default",
                                  "title": f"💬 {sender_nick}",
                                  "body": content[:100]}).encode()
            r = urlreq.Request("https://exp.host/--/api/v2/push/send", data=message,
                               headers={"Content-Type": "application/json"})
            urlreq.urlopen(r)
        except Exception:
            pass
    return {"ok": True, "messageId": msg_id, "conversationId": conv_id}

@app.post("/api/dm/conversations/{conv_id}/read")
async def mark_conv_read(conv_id: str, userId: str = None):
    """대화방 읽음 처리"""
    if not userId:
        return {"ok": False, "error": "userId required"}
    with get_db() as conn:
        conv = conn.execute("SELECT user1_id, user2_id FROM dm_conversations WHERE id=?", (conv_id,)).fetchone()
        if not conv:
            return {"ok": False, "error": "not_found"}
        if conv[0] == userId:
            conn.execute("UPDATE dm_conversations SET user1_unread=0 WHERE id=?", (conv_id,))
        elif conv[1] == userId:
            conn.execute("UPDATE dm_conversations SET user2_unread=0 WHERE id=?", (conv_id,))
        conn.execute("UPDATE dm_messages SET is_read=1 WHERE conversation_id=? AND sender_id != ?", (conv_id, userId))
        conn.commit()
    return {"ok": True}

@app.get("/api/dm/unread-count")
async def dm_unread(userId: str):
    """전체 안 읽은 메시지 수"""
    with get_db() as conn:
        row = conn.execute("""
            SELECT SUM(CASE WHEN user1_id=? THEN user1_unread ELSE user2_unread END)
            FROM dm_conversations
            WHERE user1_id=? OR user2_id=?
        """, (userId, userId, userId)).fetchone()
        return {"count": row[0] or 0 if row else 0}
