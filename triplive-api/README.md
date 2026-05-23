# triplive-api

Triplive 1.2 안전 — Cloudflare Workers 백엔드.

## 책임

- 외교부 여행경보 / 안전공지 **15분 단위 폴링** (Cron)
- D1 에 캐시 후 앱이 `GET /advisories` 로 가져감 (외교부 API 직접 호출 부담 ↓)
- 사용자가 등록한 트립 국가의 경보 변경 시 **Expo Push** 자동 발송

## 셋업 (1회)

```bash
npm install
npm run d1:schema          # 원격 D1 에 schema.sql 적용
wrangler secret put MOFA_SERVICE_KEY   # 외교부 인증키 입력 (대화형)
npm run deploy
```

## 일상 명령

```bash
npm run dev      # 로컬 (wrangler dev — D1 도 로컬)
npm run deploy   # 배포
npm run tail     # 라이브 로그
```

## 라우트

| Method | Path | 용도 |
|---|---|---|
| POST | `/push/register` | 디바이스 토큰 + 트립 국가 UPSERT |
| DELETE | `/push/register` | 알림 끄기 |
| GET | `/advisories` | 전체 advisory 캐시 |
| GET | `/advisories/:cc` | 국가별 advisory |
| GET | `/alerts/:cc` | 국가별 최근 안전공지 |
| GET | `/health` | 상태 + 마지막 cron 결과 |

## Cron

`*/15 * * * *` — 외교부 폴링 → advisories UPSERT → level 2+ 변경분에 매칭 디바이스 푸시.

## 무료 한도 내 운영

- Workers Free: 100k req/일 (15분 cron = 하루 96회로 충분)
- D1 Free: 5GB / 5M reads / 100k writes 일
- Cron Triggers: 무료

## D1 정보

- 이름: `triplive-safety`
- 리전: APAC
- ID: `13f6bd42-5083-44dc-b421-216a88087df9`
