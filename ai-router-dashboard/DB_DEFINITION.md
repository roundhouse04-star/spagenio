# DB_DEFINITION.md — spagenio stock.db 테이블 정의

> DB 파일: `stock.db` (better-sqlite3)  
> 최종 업데이트: 2026-05-10

---

## 목차
1. [users](#1-users)
2. [admin_roles / admins](#2-admin_roles--admins)
3. [invite_codes](#3-invite_codes)
4. [email_verifications](#4-email_verifications)
5. [password_reset_requests](#5-password_reset_requests)
6. [terms_agreements](#6-terms_agreements)
7. [access_logs](#7-access_logs)
8. [menus](#8-menus)
9. [schedulers](#9-schedulers)
10. [user_broker_keys](#10-user_broker_keys)
11. [user_telegram](#11-user_telegram)
12. [investor_profile](#12-investor_profile)
13. [trade_log](#13-trade_log)
14. [trade_setting_type2](#14-trade_setting_type2)
15. [trade_setting_type3](#15-trade_setting_type3)
16. [trade_setting_type4](#16-trade_setting_type4)
17. [trade_pool_type3](#17-trade_pool_type3)
18. [portfolio_performance](#18-portfolio_performance)
19. [backtest_results](#19-backtest_results)
20. [backtest_watchlist](#20-backtest_watchlist)
21. [stock_price_history](#21-stock_price_history)
22. [news](#22-news)
23. [rss_sources](#23-rss_sources)
24. [news_sentiment_score](#24-news_sentiment_score)
25. [quant_analysis](#25-quant_analysis)
26. [quant_analysis_log](#26-quant_analysis_log)
27. [quant_trade_log](#27-quant_trade_log)
28. [kr_recommendations](#28-kr_recommendations)
29. [telegram_alert_log](#29-telegram_alert_log)
30. [db_comments](#30-db_comments)

---

## 1. users
회원 계정 정보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| username | TEXT UNIQUE | 로그인 아이디 |
| password_hash | TEXT | bcrypt 해시 |
| email | TEXT | 이메일 |
| created_type | INTEGER | 가입 방식 (2=일반) |
| created_at | DATETIME | 가입일 |
| last_login | DATETIME | 최근 로그인 |

---

## 2. admin_roles / admins
관리자 역할 및 계정

### admin_roles
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| role_name | TEXT UNIQUE | 역할명 |
| description | TEXT | 설명 |
| created_at | DATETIME | |

### admins
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| username | TEXT UNIQUE | 관리자 아이디 |
| password_hash | TEXT | bcrypt 해시 |
| email | TEXT | |
| role_id | INTEGER | admin_roles.id FK |
| is_active | INTEGER | 활성 여부 (0/1) |
| created_at | DATETIME | |
| last_login | DATETIME | |

---

## 3. invite_codes
초대 코드

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| code | TEXT UNIQUE | 초대 코드 |
| created_by | INTEGER | 생성자 user_id |
| used_by | INTEGER | 사용자 user_id |
| used_at | DATETIME | 사용 시각 |
| created_at | DATETIME | |
| expires_at | DATETIME | 만료 시각 |

---

## 4. email_verifications
이메일 인증 코드

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| email | TEXT | 인증 대상 이메일 |
| code | TEXT | 인증 코드 |
| verified | INTEGER | 인증 완료 여부 (0/1) |
| created_at | DATETIME | |
| expires_at | DATETIME | 만료 시각 |

---

## 5. password_reset_requests
비밀번호 재설정 요청

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| username | TEXT | |
| status | TEXT | pending / approved / rejected |
| temp_password | TEXT | 임시 비밀번호 |
| created_at | DATETIME | |

---

## 6. terms_agreements
약관 동의 이력

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| agree_terms | INTEGER | 이용약관 동의 (0/1) |
| agree_privacy | INTEGER | 개인정보 동의 (0/1) |
| agree_investment | INTEGER | 투자 고지 동의 (0/1) |
| agree_marketing | INTEGER | 마케팅 동의 (0/1) |
| ip | TEXT | 동의 시 IP |
| agreed_at | DATETIME | |

---

## 7. access_logs
접근 로그 (요청/이벤트)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| timestamp | DATETIME | |
| ip | TEXT | |
| method | TEXT | GET/POST 등 |
| path | TEXT | 요청 경로 |
| status_code | INTEGER | HTTP 상태코드 |
| user_id | INTEGER | |
| username | TEXT | |
| user_agent | TEXT | |
| referer | TEXT | |
| response_time | INTEGER | ms |
| event_type | TEXT | request / LOGIN / LOGOUT 등 |

**인덱스:** timestamp, ip, event_type

---

## 8. menus
사이드바 메뉴 DB 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT | 메뉴명 |
| icon | TEXT | 이모지 아이콘 |
| parent_id | INTEGER | 부모 메뉴 id (NULL=최상위) |
| sort_order | INTEGER | 정렬 순서 |
| tab_key | TEXT | 탭 키 |
| sub_key | TEXT | 서브탭 키 |
| enabled | INTEGER | 활성 여부 (0/1) |
| created_at | DATETIME | |

---

## 9. schedulers
스케줄러 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT | 스케줄러 이름 |
| key | TEXT UNIQUE | 고유 키 |
| enabled | INTEGER | 활성 여부 (0/1) |
| interval_sec | INTEGER | 실행 주기 (초) |
| description | TEXT | 설명 |
| last_run | DATETIME | 최근 실행 시각 |
| run_count | INTEGER | 총 실행 횟수 |
| created_at | DATETIME | |

---

## 10. user_broker_keys
Alpaca 계좌 키 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| account_name | TEXT | 계좌 별칭 |
| alpaca_api_key | TEXT | 암호화된 API Key |
| alpaca_secret_key | TEXT | 암호화된 Secret Key |
| alpaca_paper | INTEGER | 페이퍼 여부 (1=페이퍼) |
| is_active | INTEGER | 활성 계좌 여부 (0/1) |
| account_type | INTEGER | 0=미설정 1=수동 2=자동 |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## 11. user_telegram
텔레그램 알림 설정

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER UNIQUE | users.id FK |
| chat_id | TEXT | 텔레그램 Chat ID |
| bot_token | TEXT | Bot Token |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## 12. investor_profile
투자자 성향 설문 결과

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER UNIQUE | users.id FK |
| q_period | INTEGER | 투자기간 (1:단기 2:중기 3:장기) |
| q_loss | INTEGER | 손실허용 (1:-5% 2:-10% 3:-20%) |
| q_return | INTEGER | 수익목표 (1:10% 2:20% 3:30%+) |
| q_style | INTEGER | 선호스타일 (1:대형 2:혼합 3:성장) |
| q_experience | INTEGER | 경험 (1:초보 2:1~3년 3:3년+) |
| profile_type | TEXT | aggressive/balanced/conservative/beginner |
| profile_score | INTEGER | 총점 (5~15) |
| w_momentum | REAL | 모멘텀 가중치 |
| w_value | REAL | 밸류 가중치 |
| w_quality | REAL | 퀄리티 가중치 |
| w_news | REAL | 뉴스 가중치 |
| risk_take_profit | REAL | 익절 비율 |
| risk_stop_loss | REAL | 손절 비율 |
| risk_max_positions | INTEGER | 최대 포지션 수 |
| risk_balance_ratio | REAL | 계좌 매수 비율 |
| completed | INTEGER | 설문 완료 여부 (0/1) |
| updated_at | DATETIME | |

---

## 13. trade_log
전체 매매 로그 (trade_type으로 구분)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| trade_type | INTEGER | 1=수동 2=단순자동 3=일반자동 4=완전자동 |
| symbol | TEXT | 종목 심볼 |
| action | TEXT | BUY / SELL / SELL_PROFIT / SELL_STOP 등 |
| qty | REAL | 수량 |
| price | REAL | 체결가 |
| reason | TEXT | 매매 사유 |
| order_id | TEXT | Alpaca 주문 ID |
| profit_pct | REAL | 수익률 % |
| status | TEXT | active / closed |
| broker_key_id | INTEGER | user_broker_keys.id FK |
| created_at | DATETIME | |

---

## 14. trade_setting_type2
단순 자동매매 설정 (TOP1 당일매매)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| broker_key_id | INTEGER | user_broker_keys.id FK |
| enabled | INTEGER | 활성 여부 (0/1) |
| symbol | TEXT | 매매 종목 |
| qty | REAL | 수량 |
| buy_price | REAL | 매수가 |
| order_id | TEXT | 주문 ID |
| status | TEXT | idle / bought |
| balance_ratio | REAL | 매수 비율 |
| take_profit | REAL | 익절 비율 |
| stop_loss | REAL | 손절 비율 |
| updated_at | DATETIME | |

**UNIQUE:** (user_id, broker_key_id)

---

## 15. trade_setting_type3
일반 자동매매 설정 (팩터/뉴스 기반)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| broker_key_id | INTEGER | user_broker_keys.id FK |
| enabled | INTEGER | 활성 여부 (0/1) |
| market | TEXT | nasdaq / kospi / kosdaq |
| roe_min | REAL | ROE 최소값 |
| debt_max | REAL | 부채비율 최대값 |
| revenue_min | REAL | 매출성장 최소값 |
| momentum_top | REAL | 모멘텀 상위 % |
| sma200_filter | INTEGER | SMA200 필터 사용 여부 |
| use_macd | INTEGER | MACD 사용 여부 |
| use_rsi | INTEGER | RSI 사용 여부 |
| rsi_threshold | REAL | RSI 임계값 |
| use_bb | INTEGER | 볼린저밴드 사용 여부 |
| balance_ratio | REAL | 매수 비율 |
| max_positions | INTEGER | 최대 포지션 수 |
| take_profit1 | REAL | 1차 익절 비율 |
| take_profit2 | REAL | 2차 익절 비율 |
| stop_loss | REAL | 손절 비율 |
| factor_exit | INTEGER | 팩터 청산 사용 여부 |
| sma200_exit | INTEGER | SMA200 청산 사용 여부 |
| last_rebalanced_at | DATETIME | 최근 리밸런싱 시각 |
| updated_at | DATETIME | |

**UNIQUE:** (user_id, broker_key_id)

---

## 16. trade_setting_type4
완전 자동매매 설정 (AI 신호 기반)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| broker_key_id | INTEGER | user_broker_keys.id FK |
| enabled | INTEGER | 활성 여부 (0/1) |
| symbols | TEXT | 매매 종목 (콤마 구분) |
| balance_ratio | REAL | 매수 비율 |
| take_profit | REAL | 익절 비율 |
| stop_loss | REAL | 손절 비율 |
| signal_mode | TEXT | combined / factor / technical |
| factor_strategy | TEXT | value_quality 등 |
| factor_market | TEXT | nasdaq / kospi |
| candidate_symbols | TEXT | 후보 종목 (콤마 구분) |
| kr_candidate_symbols | TEXT | 한국 후보 종목 |
| updated_at | DATETIME | |

**UNIQUE:** (user_id, broker_key_id)

---

## 17. trade_pool_type3
일반 자동매매 종목 풀

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| symbol | TEXT | 종목 심볼 |
| factor_score | REAL | 팩터 점수 |
| added_at | DATETIME | |

**UNIQUE:** (user_id, symbol)

---

## 18. portfolio_performance
성과 스냅샷 (매일 저장)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| snapshot_date | TEXT | YYYY-MM-DD |
| account_type | INTEGER | 0=전체 1=수동 2=자동 |
| broker_key_id | INTEGER | user_broker_keys.id FK (계좌별) |
| total_equity | REAL | 총 평가금액 |
| cash | REAL | 현금 |
| portfolio_value | REAL | 주식 평가액 |
| daily_pnl | REAL | 일일 손익 |
| daily_pnl_pct | REAL | 일일 수익률 % |
| total_pnl | REAL | 누적 손익 |
| total_pnl_pct | REAL | 누적 수익률 % |
| win_count | INTEGER | 익절 횟수 |
| loss_count | INTEGER | 손절 횟수 |
| max_drawdown | REAL | MDD % |
| peak_equity | REAL | 최고 자산 |
| created_at | DATETIME | |

**UNIQUE:** (user_id, snapshot_date, broker_key_id)

---

## 19. backtest_results
백테스트 결과 저장

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| name | TEXT | 결과 이름 |
| symbol | TEXT | 종목 |
| strategy | TEXT | 전략명 |
| start_date | TEXT | 시작일 |
| end_date | TEXT | 종료일 |
| initial_capital | REAL | 초기 자본 |
| final_capital | REAL | 최종 자본 |
| total_return | REAL | 총 수익률 % |
| annual_return | REAL | 연환산 수익률 % |
| max_drawdown | REAL | MDD % |
| sharpe_ratio | REAL | 샤프 비율 |
| win_rate | REAL | 승률 % |
| total_trades | INTEGER | 총 거래 횟수 |
| win_trades | INTEGER | 익절 횟수 |
| loss_trades | INTEGER | 손절 횟수 |
| take_profit | REAL | 익절 비율 |
| stop_loss | REAL | 손절 비율 |
| result_json | TEXT | 전체 결과 JSON |
| created_at | DATETIME | |

---

## 20. backtest_watchlist
백테스트 관심 종목

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| symbol | TEXT UNIQUE | 종목 심볼 |
| created_at | DATETIME | |

---

## 21. stock_price_history
주가 히스토리 DB (yfinance 저장)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| symbol | TEXT | 종목 심볼 |
| date | TEXT | YYYY-MM-DD |
| open | REAL | 시가 |
| high | REAL | 고가 |
| low | REAL | 저가 |
| close | REAL | 종가 |
| volume | INTEGER | 거래량 |
| created_at | DATETIME | |

**UNIQUE:** (symbol, date)  
**인덱스:** (symbol, date)

---

## 22. news
뉴스 수집 데이터

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| category | TEXT | 카테고리 |
| date | TEXT | 날짜 |
| saved_at | TEXT | 저장 시각 |
| use_claude | INTEGER | Claude 요약 여부 (0/1) |
| content | TEXT | 뉴스 내용 |
| source | TEXT | 출처 (rss 등) |
| created_at | DATETIME | |

**인덱스:** date, category, use_claude, source

---

## 23. rss_sources
RSS 소스 목록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT | 소스명 |
| url | TEXT UNIQUE | RSS URL |
| category | TEXT | global / korea 등 |
| enabled | INTEGER | 활성 여부 (0/1) |
| created_at | DATETIME | |

---

## 24. news_sentiment_score
뉴스 감성 분석 결과

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| symbol | TEXT | 종목 심볼 |
| news_score | REAL | 감성 점수 |
| macro_risk | REAL | 거시 리스크 점수 |
| news_count | INTEGER | 분석 기사 수 |
| news_label | TEXT | 긍정/중립/부정 |
| scored_at | DATETIME | |
| scored_date | TEXT | YYYY-MM-DD (하루 1회) |

---

## 25. quant_analysis
퀀트 분석 결과

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| symbol | TEXT | 종목 |
| strategy | TEXT | 전략명 |
| signal | TEXT | 신호 |
| indicator_value | REAL | 지표값 |
| price | REAL | 가격 |
| created_at | DATETIME | |

---

## 26. quant_analysis_log
퀀트 분석 상세 로그 (사용자별)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| symbol | TEXT | 종목 |
| strategy | TEXT | 전략명 |
| signal | TEXT | 신호 |
| price | REAL | 가격 |
| value | REAL | 지표값 |
| score | REAL | 점수 |
| reason | TEXT | 사유 |
| indicators | TEXT | 지표 JSON |
| created_at | DATETIME | |

**인덱스:** user_id, symbol

---

## 27. quant_trade_log
퀀트 매매 실행 로그

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| symbol | TEXT | 종목 |
| side | TEXT | buy / sell |
| qty | REAL | 수량 |
| price | REAL | 가격 |
| strategy | TEXT | 전략명 |
| order_id | TEXT | 주문 ID |
| created_at | DATETIME | |

---

## 28. kr_recommendations
한국 주식 추천 종목

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| ticker | TEXT | 종목 코드 |
| name | TEXT | 종목명 |
| volume | REAL | 거래량 |
| short_ratio | REAL | 공매도 비율 |
| score | REAL | 추천 점수 |
| price | REAL | 가격 |
| created_at | DATETIME | |

---

## 29. telegram_alert_log
텔레그램 알림 발송 로그

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER | users.id FK |
| alert_type | TEXT | TRADE / RISK / SIGNAL / MARKET |
| message | TEXT | 발송 메시지 |
| sent_at | DATETIME | |

---

## 30. db_comments
테이블/컬럼 설명 메모

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| table_name | TEXT | 테이블명 |
| column_name | TEXT | 컬럼명 |
| comment | TEXT | 설명 |
| updated_at | DATETIME | |

**UNIQUE:** (table_name, column_name)

---

## trade_type 구분표

| 값 | 설명 | 관련 설정 테이블 |
|----|------|----------------|
| 1 | 수동 매매 | — |
| 2 | 단순 자동매매 (TOP1 당일) | trade_setting_type2 |
| 3 | 일반 자동매매 (팩터/뉴스) | trade_setting_type3 |
| 4 | 완전 자동매매 (AI 신호) | trade_setting_type4 |

## account_type 구분표

| 값 | 설명 |
|----|------|
| 0 | 전체 (is_active 계좌) |
| 1 | 수동 전용 계좌 |
| 2 | 자동매매 전용 계좌 |
