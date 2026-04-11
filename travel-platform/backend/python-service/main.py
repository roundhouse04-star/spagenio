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
MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20MB
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
        raise HTTPException(400, "파일 크기는 20MB 이하여야 합니다.")

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
                     "wishCountries": user.get("wish_countries", "[]")}}

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
            "profileImage": user.get("profileImage", ""), "bio": user.get("bio", "")}

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
