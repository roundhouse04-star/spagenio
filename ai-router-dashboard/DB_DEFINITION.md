# 📦 spagenio DB 정의서

> **DB 파일**: `news.db` (SQLite)  
> **최종 수정**: 2026-03-27  
> **총 테이블 수**: 15개

---

## 목차

1. [news](#1-news)
2. [users](#2-users)
3. [user_broker_keys](#3-user_broker_keys)
4. [terms_agreements](#4-terms_agreements)
5. [email_verifications](#5-email_verifications)
6. [invite_codes](#6-invite_codes)
7. [access_logs](#7-access_logs)
8. [user_telegram](#8-user_telegram)
9. [lotto_picks](#9-lotto_picks)
10. [lotto_history](#10-lotto_history)
11. [lotto_schedule](#11-lotto_schedule)
12. [lotto_schedule_log](#12-lotto_schedule_log)
13. [lotto_algorithm_weights](#13-lotto_algorithm_weights)
14. [auto_trade_settings](#14-auto_trade_settings)
15. [auto_trade_log](#15-auto_trade_log)
16. [quant_analysis_log](#16-quant_analysis_log)
17. [db_comments](#17-db_comments)

---

## 1. news

> n8n 워크플로우를 통해 수집된 뉴스 데이터 저장 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| category | TEXT | ✅ | - | 카테고리 (global/korea/it/economy) |
| date | TEXT | ✅ | - | 뉴스 날짜 (YYYY-MM-DD) |
| saved_at | TEXT | ✅ | - | 수집 저장 시각 |
| use_claude | INTEGER | | 0 | Claude 분석 여부 (0/1) |
| source | TEXT | | 'rss' | 수집 방식 (rss/claude/gpt) |
| content | TEXT | | '' | 뉴스 본문 또는 요약 |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 레코드 생성 시각 |

**인덱스**
- `idx_news_date` — date
- `idx_news_category` — category
- `idx_news_use_claude` — use_claude
- `idx_news_source` — source

---

## 2. users

> 서비스 회원 정보 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| username | TEXT | ✅ | - | 로그인 아이디 (3~10자, 영문/숫자/언더바, UNIQUE) |
| password_hash | TEXT | ✅ | - | bcrypt 12라운드 해시 |
| email | TEXT | | NULL | AES-256-CBC 암호화 저장 |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 가입 시각 |
| last_login | DATETIME | | NULL | 마지막 로그인 시각 |

---

## 3. user_broker_keys

> 유저별 Alpaca 증권 API 키 관리 테이블 (다계좌 지원)

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (FK) |
| account_name | TEXT | ✅ | '기본 계좌' | 계좌 별칭 |
| alpaca_api_key | TEXT | | NULL | Alpaca API Key (AES-256 암호화) |
| alpaca_secret_key | TEXT | | NULL | Alpaca Secret Key (AES-256 암호화) |
| alpaca_paper | INTEGER | | 1 | 페이퍼 트레이딩 여부 (1=페이퍼, 0=실거래) |
| is_active | INTEGER | | 0 | 현재 활성 계좌 여부 (1=활성) |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 등록 시각 |
| updated_at | DATETIME | | CURRENT_TIMESTAMP | 최종 수정 시각 |

---

## 4. terms_agreements

> 회원가입 시 약관 동의 내역 저장 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (FK) |
| agree_terms | INTEGER | | 0 | 이용약관 동의 (0/1) |
| agree_privacy | INTEGER | | 0 | 개인정보처리방침 동의 (0/1) |
| agree_investment | INTEGER | | 0 | 투자위험고지 동의 (0/1) |
| agree_marketing | INTEGER | | 0 | 마케팅 수신 동의 (0/1) |
| ip | TEXT | | NULL | 동의 시 IP 주소 |
| agreed_at | DATETIME | | CURRENT_TIMESTAMP | 동의 시각 |

---

## 5. email_verifications

> 회원가입/비밀번호 찾기 시 이메일 인증코드 관리 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| email | TEXT | ✅ | - | 인증 대상 이메일 |
| code | TEXT | ✅ | - | 6자리 인증코드 |
| verified | INTEGER | | 0 | 인증 완료 여부 (0/1) |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 코드 발급 시각 |
| expires_at | DATETIME | ✅ | - | 코드 만료 시각 (발급 후 60초) |

---

## 6. invite_codes

> 초대 코드 관리 테이블 (관리자가 발급, 가입 시 사용)

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| code | TEXT | ✅ | - | 초대 코드 문자열 (UNIQUE) |
| created_by | INTEGER | | NULL | 코드 생성 관리자 user_id |
| used_by | INTEGER | | NULL | 코드 사용 유저 user_id |
| used_at | DATETIME | | NULL | 코드 사용 시각 |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 코드 생성 시각 |
| expires_at | DATETIME | | NULL | 코드 만료 시각 |

---

## 7. access_logs

> 서버 접근 및 이벤트 로그 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| timestamp | DATETIME | | CURRENT_TIMESTAMP | 요청 시각 |
| ip | TEXT | | NULL | 클라이언트 IP |
| method | TEXT | | NULL | HTTP 메서드 (GET/POST 등) |
| path | TEXT | | NULL | 요청 경로 |
| status_code | INTEGER | | NULL | HTTP 응답 코드 |
| user_id | INTEGER | | NULL | 요청 유저 ID (비로그인 시 NULL) |
| username | TEXT | | NULL | 요청 유저명 (비로그인 시 NULL) |
| user_agent | TEXT | | NULL | 브라우저/클라이언트 정보 |
| referer | TEXT | | NULL | 이전 페이지 URL |
| response_time | INTEGER | | NULL | 응답 시간 (ms) |
| event_type | TEXT | | 'request' | 이벤트 유형 (request/LOGIN_SUCCESS/LOGIN_FAILED 등) |

**인덱스**
- `idx_logs_timestamp` — timestamp
- `idx_logs_ip` — ip
- `idx_logs_event` — event_type

---

## 8. user_telegram

> 유저별 텔레그램 연동 정보 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (UNIQUE — 1유저 1계정) |
| chat_id | TEXT | ✅ | - | 텔레그램 Chat ID |
| bot_token | TEXT | | NULL | 텔레그램 Bot Token (미입력 시 env TG_BOT_TOKEN 사용) |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 등록 시각 |
| updated_at | DATETIME | | CURRENT_TIMESTAMP | 최종 수정 시각 |

---

## 9. lotto_picks

> 유저별 로또 추천 번호 저장 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (FK) |
| pick_date | TEXT | ✅ | - | 번호 생성 날짜 (YYYY-MM-DD) |
| game_index | INTEGER | ✅ | - | 게임 순서 (0부터 시작) |
| numbers | TEXT | ✅ | - | 추천 번호 JSON 배열 (예: [1,7,23,33,40,42]) |
| algorithms | TEXT | | NULL | 적용 알고리즘 정보 |
| drw_no | INTEGER | | NULL | 대응 당첨 회차 번호 |
| rank | INTEGER | | NULL | 당첨 등수 (NULL=미확인, 0=낙첨) |
| matched_count | INTEGER | | NULL | 일치 번호 개수 |
| bonus_match | INTEGER | | 0 | 보너스 번호 일치 여부 (0/1) |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 생성 시각 |

---

## 10. lotto_history

> 역대 로또 당첨 번호 저장 테이블 (동행복권 API 수집)

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| drw_no | INTEGER | ✅ | - | 회차 번호 (PK) |
| numbers | TEXT | ✅ | - | 당첨 번호 JSON 배열 |
| bonus | INTEGER | | NULL | 보너스 번호 |
| drw_date | TEXT | | NULL | 추첨 날짜 |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 저장 시각 |

---

## 11. lotto_schedule

> 유저별 로또 번호 자동 발송 스케줄 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (UNIQUE — 1유저 1스케줄) |
| enabled | INTEGER | | 0 | 스케줄 활성 여부 (0/1) |
| days | TEXT | | '1,2,3,4,5,6' | 발송 요일 (0=일~6=토, 쉼표 구분) |
| hour | INTEGER | | 9 | 발송 시각 (0~23) |
| game_count | INTEGER | | 5 | 1회 발송 게임 수 |
| last_sent_at | DATETIME | | NULL | 마지막 발송 시각 |
| updated_at | DATETIME | | CURRENT_TIMESTAMP | 최종 수정 시각 |

---

## 12. lotto_schedule_log

> 로또 스케줄 발송 이력 로그 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (FK) |
| days | TEXT | | NULL | 발송된 요일 |
| hour | INTEGER | | NULL | 발송된 시각 |
| game_count | INTEGER | | NULL | 발송된 게임 수 |
| action | TEXT | | 'update' | 액션 유형 (update/send) |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 로그 생성 시각 |

---

## 13. lotto_algorithm_weights

> 유저별 로또 알고리즘 가중치 설정 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (UNIQUE) |
| weights | TEXT | ✅ | '{}' | 알고리즘별 가중치 JSON (freq/hot/cold/balance/zone/ac/prime/delta) |
| updated_at | DATETIME | | CURRENT_TIMESTAMP | 최종 수정 시각 |

**weights JSON 예시**
```json
{
  "freq": 20,
  "hot": 20,
  "cold": 10,
  "balance": 15,
  "zone": 10,
  "ac": 10,
  "prime": 5,
  "delta": 10
}
```

---

## 14. auto_trade_settings

> 유저별 자동매매 설정 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (UNIQUE) |
| enabled | INTEGER | | 0 | 자동매매 활성 여부 (0/1) |
| symbols | TEXT | | 'QQQ,SPY,AAPL' | 매매 대상 종목 (쉼표 구분) |
| candidate_symbols | TEXT | | 'QQQ,SPY,...' | 매수 후보 종목 풀 (쉼표 구분) |
| max_positions | INTEGER | | 3 | 최대 동시 보유 종목 수 |
| balance_ratio | REAL | | 0.1 | 계좌 잔고 대비 매수 비율 (0.1=10%) |
| take_profit | REAL | | 0.05 | 익절 기준 수익률 (0.05=5%) |
| stop_loss | REAL | | 0.05 | 손절 기준 손실률 (0.05=5%) |
| signal_mode | TEXT | | 'combined' | 매수 신호 방식 (macd/combined) |
| updated_at | DATETIME | | CURRENT_TIMESTAMP | 최종 수정 시각 |

---

## 15. auto_trade_log

> 자동매매 체결 이력 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (FK) |
| symbol | TEXT | ✅ | - | 매매 종목 심볼 |
| action | TEXT | ✅ | - | 매매 구분 (BUY/SELL_PROFIT/SELL_LOSS) |
| qty | REAL | | NULL | 매매 수량 (주) |
| price | REAL | | NULL | 체결 가격 ($) |
| reason | TEXT | | NULL | 매매 사유 (예: MACD 골든크로스, 익절 +5.2%) |
| order_id | TEXT | | NULL | Alpaca 주문 ID |
| profit_pct | REAL | | NULL | 수익률 (%) — 매도 시 기록 |
| status | TEXT | | 'active' | 포지션 상태 (active/closed) |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 체결 시각 |

---

## 16. quant_analysis_log

> 종목 퀀트 분석 이력 저장 테이블 (분석 시 자동 저장)

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| user_id | INTEGER | ✅ | - | users.id 참조 (FK) |
| symbol | TEXT | ✅ | - | 분석 종목 심볼 |
| strategy | TEXT | ✅ | - | 분석 전략 (combined/rsi/bb/sma/macd) |
| signal | TEXT | | NULL | 매매 신호 (buy/weak_buy/hold/weak_sell/sell) |
| price | REAL | | NULL | 분석 시점 현재가 ($) |
| value | REAL | | NULL | 지표값 (전략별 상이) |
| score | REAL | | NULL | 복합 점수 |
| reason | TEXT | | NULL | 분석 요약 텍스트 |
| indicators | TEXT | | NULL | 세부 지표 JSON |
| created_at | DATETIME | | CURRENT_TIMESTAMP | 분석 시각 |

**인덱스**
- `idx_quant_log_user` — user_id
- `idx_quant_log_symbol` — symbol

---

## 17. db_comments

> DB 컬럼 설명 메타 정보 테이블

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|:--------:|--------|------|
| id | INTEGER | ✅ | AUTOINCREMENT | 자동 증가 PK |
| table_name | TEXT | ✅ | - | 테이블명 |
| column_name | TEXT | ✅ | - | 컬럼명 |
| comment | TEXT | ✅ | - | 컬럼 설명 |
| updated_at | DATETIME | | CURRENT_TIMESTAMP | 최종 수정 시각 |

**UNIQUE**: (table_name, column_name)

---

## ERD 관계 요약

```
users (1) ──── (N) user_broker_keys
users (1) ──── (1) terms_agreements
users (1) ──── (1) user_telegram
users (1) ──── (N) lotto_picks
users (1) ──── (1) lotto_schedule
users (1) ──── (N) lotto_schedule_log
users (1) ──── (1) lotto_algorithm_weights
users (1) ──── (1) auto_trade_settings
users (1) ──── (N) auto_trade_log
users (1) ──── (N) quant_analysis_log
```

---

## 암호화 정책

| 대상 | 방식 | 비고 |
|------|------|------|
| 비밀번호 | bcrypt (12라운드) | 단방향 해시 |
| 이메일 | AES-256-CBC | 복호화 가능, IV 포함 저장 |
| Alpaca API Key | AES-256-CBC | 복호화 가능, IV 포함 저장 |
| Alpaca Secret Key | AES-256-CBC | 복호화 가능, IV 포함 저장 |
