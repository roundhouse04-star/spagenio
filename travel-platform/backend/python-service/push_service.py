import json
import urllib.request
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'travellog.db')

def get_push_token(user_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    row = c.execute("SELECT push_token, push_consent FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    if row and row[0] and row[1] == 1:
        return row[0]
    return None

def send_push(to_user_id, title, body, data=None):
    token = get_push_token(to_user_id)
    if not token:
        return False
    
    message = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
    }
    if data:
        message["data"] = data
    
    req = urllib.request.Request(
        "https://exp.host/--/api/v2/push/send",
        data=json.dumps(message).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req)
        return True
    except Exception as e:
        print(f"Push error: {e}")
        return False

def notify_like(post_owner_id, liker_nickname, post_title):
    send_push(post_owner_id, "좋아요", f"{liker_nickname}님이 '{post_title}'을 좋아합니다 ❤️")

def notify_comment(post_owner_id, commenter_nickname, post_title, comment_text):
    body = f"{commenter_nickname}님이 댓글을 남겼어요: {comment_text[:30]}"
    send_push(post_owner_id, f"💬 {post_title}", body)

def notify_follow(user_id, follower_nickname):
    send_push(user_id, "새 팔로워", f"{follower_nickname}님이 회원님을 팔로우합니다 👤")

def notify_plan_reminder(user_id, plan_title, days_left):
    if days_left == 0:
        body = f"오늘 '{plan_title}' 출발이에요! ✈️"
    elif days_left == 1:
        body = f"내일 '{plan_title}' 출발! 준비 다 됐나요? 🧳"
    else:
        body = f"'{plan_title}' 출발 {days_left}일 전이에요 🗺️"
    send_push(user_id, "여행 알림", body)
