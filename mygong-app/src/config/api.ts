/**
 * 외부 API 엔드포인트 상수.
 *
 * KOPIS 키 같은 비밀값은 Cloudflare Worker 환경변수에 저장하고,
 * 클라이언트는 이 Worker URL 을 통해서만 호출한다.
 * (키가 앱 소스에 노출되지 않아서 앱스토어 배포에 안전)
 *
 * Worker 소스: https://dash.cloudflare.com/ → Workers → mygong-api
 * Worker 에 등록된 Secret: KOPIS_API_KEY
 */

/** mygong-api (Cloudflare Worker) 베이스 URL — 공개되어도 안전 */
export const MYGONG_API_BASE = 'https://mygong-api.roundhouse04.workers.dev';

/** KOPIS 공연목록 프록시 엔드포인트 */
export const MYGONG_API_KOPIS_LIST = `${MYGONG_API_BASE}/performances`;

/** KOPIS 공연상세 프록시 엔드포인트 (뒤에 /{mt20id} 붙임) */
export const MYGONG_API_KOPIS_DETAIL = `${MYGONG_API_BASE}/performance`;

/** 네트워크 타임아웃 (ms) */
export const API_TIMEOUT_MS = 12000;
