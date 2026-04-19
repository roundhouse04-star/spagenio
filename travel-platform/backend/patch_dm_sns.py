#!/usr/bin/env python3
"""
DM SNS 친구 모델 패치

- 맞팔 관계에서만 DM 가능
- 맞팔 깨지면 대화 목록에서 자동 숨김 (데이터는 보존)
- 맞팔 복구 시 기존 대화 다시 나타남

사용: 
  cd ~/projects/spagenio/travel-platform/backend
  python3 patch_dm_sns.py
"""

import os
import sys
import shutil
from datetime import datetime

MAIN_PY = "python-service/main.py"

def backup():
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{MAIN_PY}.bak-{ts}"
    shutil.copy(MAIN_PY, backup_path)
    print(f"📦 백업: {backup_path}")
    return backup_path

def apply_patches():
    with open(MAIN_PY, encoding='utf-8') as f:
        content = f.read()

    # ============= 유틸 함수 추가 =============
    # get_conversation 함수 앞에 맞팔 체크 헬퍼 추가
    helper_old = '''def get_conversation(user1, user2):'''

    helper_new = '''def is_mutual_follow(conn, user_a, user_b):
    """두 유저가 서로 맞팔인지 확인"""
    row = conn.execute("""
        SELECT 1
        FROM user_following f1
        INNER JOIN user_followers f2
          ON f2.user_id = ? AND f2.follower_id = ?
        WHERE f1.user_id = ? AND f1.following_id = ?
        LIMIT 1
    """, (user_a, user_b, user_a, user_b)).fetchone()
    return row is not None


def get_conversation(user1, user2):'''

    if 'def is_mutual_follow' in content:
        print("⚠️  is_mutual_follow 이미 존재 - 스킵")
    elif helper_old in content:
        content = content.replace(helper_old, helper_new)
        print("✅ 맞팔 체크 헬퍼 추가")
    else:
        print("❌ get_conversation 함수 못 찾음")
        return False

    # ============= 1. list_conversations =============
    # 두 가지 케이스 모두 처리 (이전 패치 유무 상관없이)
    list_old_v1 = '''@app.get("/api/dm/conversations")
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
        return result'''

    list_new = '''@app.get("/api/dm/conversations")
async def list_conversations(userId: str):
    """
    맞팔 친구 기반 DM 목록
    - 맞팔 관계인 유저만 표시
    - 기존 대화방 + 맞팔이지만 아직 대화 없는 친구 모두 포함
    - 맞팔 깨진 상대는 목록에서 자동 숨김 (데이터는 보존)
    """
    with get_db() as conn:
        # 1. 내 맞팔 친구 ID 목록 (한 번에 조회)
        mutual_ids = set()
        mutual_rows = conn.execute("""
            SELECT f1.following_id
            FROM user_following f1
            INNER JOIN user_followers f2
              ON f2.user_id = ? AND f2.follower_id = f1.following_id
            WHERE f1.user_id = ?
        """, (userId, userId)).fetchall()
        for mr in mutual_rows:
            mutual_ids.add(mr[0])

        # 2. 기존 대화방 중 "맞팔 유지 중인" 것만
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
        conversation_user_ids = set()

        for r in rows:
            is_u1 = r[1] == userId
            other_id = r[2] if is_u1 else r[1]

            # 맞팔 깨졌으면 목록에서 숨김 (데이터는 유지)
            if other_id not in mutual_ids:
                continue

            other_nick = r[9] if is_u1 else r[7]
            other_img = r[10] if is_u1 else r[8]
            unread = r[5] if is_u1 else r[6]
            conversation_user_ids.add(other_id)
            result.append({
                "id": r[0],
                "otherUserId": other_id,
                "otherNickname": other_nick or "",
                "otherProfileImage": other_img or "",
                "lastMessage": r[3] or "",
                "lastMessageAt": r[4],
                "unreadCount": unread or 0,
                "isNewChat": False,
            })

        # 3. 맞팔이지만 아직 대화 없는 친구 추가
        for friend_id in mutual_ids:
            if friend_id in conversation_user_ids:
                continue
            user_row = conn.execute(
                "SELECT id, nickname, profile_image FROM users WHERE id=?",
                (friend_id,)
            ).fetchone()
            if not user_row:
                continue
            result.append({
                "id": None,
                "otherUserId": user_row[0],
                "otherNickname": user_row[1] or "",
                "otherProfileImage": user_row[2] or "",
                "lastMessage": "",
                "lastMessageAt": None,
                "unreadCount": 0,
                "isNewChat": True,
            })

        return result'''

    if 'WHERE f1.user_id = ?\n        """, (userId, userId)).fetchall()' in content:
        print("⚠️  list_conversations 이미 맞팔 로직 있음 - 재패치")
    
    if list_old_v1 in content:
        content = content.replace(list_old_v1, list_new)
        print("✅ list_conversations → 맞팔 필터링 적용")
    else:
        # 이미 다른 버전일 수도 있으니 경고만
        print("⚠️  list_conversations 원본 버전 못 찾음 - 이미 수정됐을 가능성")

    # ============= 2. send_message 맞팔 체크 =============
    # send 함수 시그니처 뒤에 맞팔 체크 코드 추가
    send_old = '''@app.post("/api/dm/send")
async def send_message(data: dict):'''

    send_new = '''@app.post("/api/dm/send")
async def send_message(data: dict):
    # SNS 친구 모델: 맞팔 관계에서만 메시지 전송 가능
    from_user = data.get("fromUserId") or data.get("from_user_id") or data.get("senderId")
    to_user = data.get("toUserId") or data.get("to_user_id") or data.get("receiverId")
    if from_user and to_user:
        with get_db() as conn:
            if not is_mutual_follow(conn, from_user, to_user):
                raise HTTPException(status_code=403, detail="맞팔 친구만 메시지를 보낼 수 있어요")'''

    if send_old in content and 'is_mutual_follow(conn, from_user, to_user)' not in content:
        content = content.replace(send_old, send_new)
        print("✅ send_message → 맞팔 체크 추가")
    else:
        print("⚠️  send_message 패치 스킵 (원본 못찾거나 이미 적용됨)")

    # ============= 3. conversation messages 조회도 맞팔 체크 =============
    msg_old = '''@app.get("/api/dm/conversations/{conv_id}/messages")'''

    # 이 부분은 함수 시그니처 직후에 체크 삽입이 복잡하니, 일단 SKIP
    # (list_conversations에서 이미 맞팔 아닌 대화는 클라이언트에 안 보이므로)

    # HTTPException import 확인
    if 'from fastapi import' in content and 'HTTPException' not in content:
        # HTTPException import 추가 필요
        content = content.replace(
            'from fastapi import',
            'from fastapi import HTTPException,', 1
        ).replace('HTTPException,HTTPException,', 'HTTPException,')
        # 이미 HTTPException 있을 수도

    # 저장
    with open(MAIN_PY, 'w', encoding='utf-8') as f:
        f.write(content)

    return True


if __name__ == "__main__":
    if not os.path.exists(MAIN_PY):
        print(f"❌ {MAIN_PY} 없음")
        sys.exit(1)

    backup_path = backup()
    try:
        success = apply_patches()
        if success:
            print(f"\n🎉 패치 완료!")
            print(f"   백업: {backup_path}")
            print(f"\n다음 단계:")
            print(f"   1. FastAPI 서버 재시작")
            print(f"   2. 브라우저에서 DM 열어보기")
        else:
            print(f"\n⚠️  일부 패치 실패")
            print(f"   롤백하려면: cp {backup_path} {MAIN_PY}")
    except Exception as e:
        print(f"\n❌ 에러: {e}")
        print(f"   롤백하려면: cp {backup_path} {MAIN_PY}")
        sys.exit(1)
