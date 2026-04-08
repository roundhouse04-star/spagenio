from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
import smtplib
import random
import string
import json
import os
import hashlib
import hmac
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173", "https://travel.spagenio.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 설정 ────────────────────────────────────────────────
GMAIL_USER = os.getenv("GMAIL_USER", "your@gmail.com")       # Gmail 주소
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")     # Gmail 앱 비밀번호
SECRET_KEY = os.getenv("SECRET_KEY", "travellog-secret-2026")

DB_PATH = Path("data/auth-db.json")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# 인증코드 임시 저장 (메모리) - {email: {code, expires_at, type}}
verify_store: dict = {}


# ── DB 헬퍼 ──────────────────────────────────────────────
def load_db() -> dict:
    if DB_PATH.exists():
        return json.loads(DB_PATH.read_text())
    return {"users": []}

def save_db(db: dict):
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2))

def hash_password(password: str) -> str:
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()

def make_token(user_id: str) -> str:
    payload = f"{user_id}:{int(time.time())}"
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    import base64
    return base64.b64encode(f"{payload}.{sig}".encode()).decode()

def verify_token(token: str) -> Optional[str]:
    try:
        import base64
        decoded = base64.b64decode(token.encode()).decode()
        payload, sig = decoded.rsplit(".", 1)
        expected = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        user_id, ts = payload.split(":", 1)
        return user_id
    except Exception:
        return None


# ── 이메일 발송 ──────────────────────────────────────────
def send_email(to: str, subject: str, html_body: str):
    if not GMAIL_APP_PASSWORD:
        # 테스트 모드: 콘솔 출력
        print(f"\n📧 [EMAIL TEST] To: {to}")
        print(f"Subject: {subject}")
        print(f"Body: {html_body}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Travellog <{GMAIL_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, to, msg.as_string())

def make_code() -> str:
    return "".join(random.choices(string.digits, k=6))

def code_email_html(code: str, purpose: str = "이메일 인증") -> str:
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#f5f6f8;padding:32px 20px;">
      <div style="background:white;border-radius:20px;padding:36px;border:1px solid #eee;">
        <h1 style="font-size:24px;font-weight:900;color:#4f46e5;margin:0 0 4px;">✈ Travellog</h1>
        <p style="color:#6b7280;font-size:14px;margin:0 0 28px;">{purpose}</p>
        <p style="color:#1a1a2e;font-size:15px;margin:0 0 20px;">아래 인증코드를 입력해주세요. 코드는 <strong>5분간</strong> 유효합니다.</p>
        <div style="background:#eef2ff;border:2px solid #c7d2fe;border-radius:14px;padding:20px;text-align:center;margin:0 0 24px;">
          <span style="font-size:36px;font-weight:900;color:#4f46e5;letter-spacing:8px;">{code}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin:0;">이 이메일을 요청하지 않으셨다면 무시하셔도 됩니다.</p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">© 2026 Travellog</p>
    </div>
    """


# ── 모델 ──────────────────────────────────────────────────
class SendCodeRequest(BaseModel):
    email: str
    nickname: Optional[str] = None

class RegisterRequest(BaseModel):
    nickname: str
    email: str
    password: str
    verifyCode: str
    agree_terms: bool = False
    agree_privacy: bool = False
    agree_content: bool = False
    agree_location: bool = False
    agree_marketing: bool = False

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotSendRequest(BaseModel):
    email: str

class ForgotResetRequest(BaseModel):
    email: str
    verifyCode: str
    newPassword: str

class ChangePwRequest(BaseModel):
    verifyCode: str
    newPassword: str

class WithdrawRequest(BaseModel):
    password: str


# ── 공통 토큰 추출 ────────────────────────────────────────
def get_current_user_id(authorization: str = "") -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "인증이 필요합니다.")
    token = authorization[7:]
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(401, "유효하지 않은 토큰입니다.")
    return user_id

from fastapi import Header

# ── 헬스체크 ──────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "travellog-auth"}


# ── 회원가입: 인증코드 발송 ──────────────────────────────
@app.post("/api/auth/register/send-code")
def register_send_code(req: SendCodeRequest):
    db = load_db()
    # 이메일 중복 확인
    if any(u["email"] == req.email for u in db["users"]):
        raise HTTPException(400, "이미 사용 중인 이메일입니다.")
    # 닉네임 중복 확인
    if req.nickname and any(u["nickname"] == req.nickname for u in db["users"]):
        raise HTTPException(400, "이미 사용 중인 닉네임입니다.")

    code = make_code()
    verify_store[req.email] = {
        "code": code,
        "expires_at": time.time() + 300,
        "type": "register"
    }
    send_email(req.email, "[Travellog] 회원가입 이메일 인증코드", code_email_html(code, "회원가입 이메일 인증"))
    return {"message": "인증코드가 발송됐습니다."}


# ── 회원가입 완료 ─────────────────────────────────────────
@app.post("/api/auth/register")
def register(req: RegisterRequest):
    if not req.agree_terms or not req.agree_privacy or not req.agree_content:
        raise HTTPException(400, "필수 약관에 동의해주세요.")

    store = verify_store.get(req.email)
    if not store or store["type"] != "register":
        raise HTTPException(400, "인증코드를 먼저 발송해주세요.")
    if time.time() > store["expires_at"]:
        raise HTTPException(400, "인증코드가 만료됐습니다. 재발송해주세요.")
    if store["code"] != req.verifyCode:
        raise HTTPException(400, "인증코드가 올바르지 않습니다.")

    db = load_db()
    if any(u["email"] == req.email for u in db["users"]):
        raise HTTPException(400, "이미 사용 중인 이메일입니다.")
    if any(u["nickname"] == req.nickname for u in db["users"]):
        raise HTTPException(400, "이미 사용 중인 닉네임입니다.")

    import uuid
    user = {
        "id": str(uuid.uuid4())[:12],
        "nickname": req.nickname,
        "email": req.email,
        "password": hash_password(req.password),
        "profileImage": "",
        "bio": "",
        "agree_marketing": req.agree_marketing,
        "created_at": int(time.time())
    }
    db["users"].append(user)
    save_db(db)
    del verify_store[req.email]

    return {"message": "가입이 완료됐습니다.", "userId": user["id"]}


# ── 로그인 ────────────────────────────────────────────────
@app.post("/api/auth/login")
def login(req: LoginRequest):
    db = load_db()
    user = next((u for u in db["users"] if u["email"] == req.email), None)
    if not user or user["password"] != hash_password(req.password):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")

    token = make_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "nickname": user["nickname"],
            "profileImage": user.get("profileImage", ""),
            "bio": user.get("bio", ""),
        }
    }


# ── 비밀번호 찾기: 코드 발송 ──────────────────────────────
@app.post("/api/auth/forgot-password/send-code")
def forgot_send_code(req: ForgotSendRequest):
    db = load_db()
    user = next((u for u in db["users"] if u["email"] == req.email), None)
    if not user:
        # 보안상 항상 성공처럼 응답
        return {"message": "인증코드가 발송됐습니다."}

    code = make_code()
    verify_store[req.email] = {
        "code": code,
        "expires_at": time.time() + 300,
        "type": "forgot"
    }
    send_email(req.email, "[Travellog] 비밀번호 찾기 인증코드", code_email_html(code, "비밀번호 찾기 인증"))
    return {"message": "인증코드가 발송됐습니다."}


# ── 비밀번호 찾기: 재설정 ─────────────────────────────────
@app.post("/api/auth/forgot-password/reset")
def forgot_reset(req: ForgotResetRequest):
    store = verify_store.get(req.email)
    if not store or store["type"] != "forgot":
        raise HTTPException(400, "인증코드를 먼저 발송해주세요.")
    if time.time() > store["expires_at"]:
        raise HTTPException(400, "인증코드가 만료됐습니다.")
    if store["code"] != req.verifyCode:
        raise HTTPException(400, "인증코드가 올바르지 않습니다.")

    db = load_db()
    for user in db["users"]:
        if user["email"] == req.email:
            user["password"] = hash_password(req.newPassword)
            break
    save_db(db)
    del verify_store[req.email]
    return {"message": "비밀번호가 변경됐습니다."}


# ── 비밀번호 변경 (로그인 상태): 코드 발송 ────────────────
@app.post("/api/auth/change-password/send-code")
def change_pw_send_code(authorization: str = Header(default="")):
    user_id = get_current_user_id(authorization)
    db = load_db()
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")

    code = make_code()
    verify_store[user["email"]] = {
        "code": code,
        "expires_at": time.time() + 300,
        "type": "change"
    }
    send_email(user["email"], "[Travellog] 비밀번호 변경 인증코드", code_email_html(code, "비밀번호 변경 인증"))
    return {"message": "인증코드가 발송됐습니다."}


# ── 비밀번호 변경 완료 ────────────────────────────────────
@app.post("/api/auth/change-password")
def change_password(req: ChangePwRequest, authorization: str = Header(default="")):
    user_id = get_current_user_id(authorization)
    db = load_db()
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")

    store = verify_store.get(user["email"])
    if not store or store["type"] != "change":
        raise HTTPException(400, "인증코드를 먼저 발송해주세요.")
    if time.time() > store["expires_at"]:
        raise HTTPException(400, "인증코드가 만료됐습니다.")
    if store["code"] != req.verifyCode:
        raise HTTPException(400, "인증코드가 올바르지 않습니다.")

    user["password"] = hash_password(req.newPassword)
    save_db(db)
    del verify_store[user["email"]]
    return {"message": "비밀번호가 변경됐습니다."}


# ── 회원 탈퇴 ─────────────────────────────────────────────
@app.post("/api/auth/withdraw")
def withdraw(req: WithdrawRequest, authorization: str = Header(default="")):
    user_id = get_current_user_id(authorization)
    db = load_db()
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    if user["password"] != hash_password(req.password):
        raise HTTPException(401, "비밀번호가 올바르지 않습니다.")

    db["users"] = [u for u in db["users"] if u["id"] != user_id]
    save_db(db)
    return {"message": "탈퇴가 완료됐습니다."}


# ── 내 정보 조회 ──────────────────────────────────────────
@app.get("/api/auth/me")
def get_me(authorization: str = Header(default="")):
    user_id = get_current_user_id(authorization)
    db = load_db()
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    return {
        "id": user["id"],
        "nickname": user["nickname"],
        "email": user["email"],
        "profileImage": user.get("profileImage", ""),
        "bio": user.get("bio", ""),
    }
