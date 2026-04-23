/**
 * 내공연관리 — Entity types.
 * DB 행(row)과 앱 내 객체를 구분 없이 쓰는 UI 친화적 camelCase 타입.
 */

export type Artist = {
  id: number;
  externalId?: string;        // Wikipedia pageId 같은 외부 레퍼런스
  name: string;
  nameEn?: string;
  role?: string;              // "가수", "배우 · 뮤지컬" 등
  tag?: string;               // "가수" | "배우" | "야구" ...
  emoji?: string;
  avatarUrl?: string;         // 원격 이미지
  thumbColor?: string;        // 아바타 배경 (이미지 없을 때)
  bio?: string;
  followers?: string;
  isFollowing: boolean;
  notifyEnabled: boolean;
  lastSyncedAt?: string;      // ISO
  createdAt: string;
  updatedAt: string;
};

export type Event = {
  id: number;
  artistId?: number;
  externalId?: string;
  title: string;
  category: string;            // "콘서트" | "뮤지컬" | "야구" ...
  catIcon?: string;            // emoji
  date: string;                // YYYY-MM-DD
  weekday?: string;            // "월"·"화"…
  time?: string;               // "19:30"
  venue?: string;
  city?: string;
  price?: string;
  ticketUrl?: string;
  posterUrl?: string;
  notifyEnabled: boolean;
  isWishlisted?: boolean;      // v2: 위시리스트
  ticketOpenAt?: string;       // v2: "YYYY-MM-DD HH:mm"
  notes?: string;
  source?: string;             // "wikipedia" | "ticketlink" | "manual"
  createdAt: string;
  updatedAt: string;
};

/** v2: 항목별 별점 — key는 RATING_ITEMS의 key와 매칭 */
export type DetailedRatings = Record<string, number>;

export type Ticket = {
  id: number;
  artistId?: number;
  eventId?: number;            // 연결된 Event (있을 수도)
  title: string;
  category: string;
  catIcon?: string;
  date: string;
  month: string;               // YYYY-MM
  venue?: string;
  seat?: string;
  photoUri?: string;
  rating: number;              // 0~5
  detailedRatings?: DetailedRatings;  // v2: 항목별 별점
  price?: number;                     // v2: 가격 (원)
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: number;
  kind: 'dday' | 'new_event' | 'new_info' | 'manual';
  title: string;
  subtitle?: string;
  icon?: string;
  artistId?: number;
  eventId?: number;
  ticketId?: number;
  createdAt: string;           // 정확한 시각
  dateGroup?: string;          // "오늘" | "어제" | "이번주" (동적 계산 결과 캐시)
  isNew: boolean;
};

/** 앱 시작 시 싱크 로직이 참조하는 "이 아티스트를 언제/어떻게 갱신했나" 테이블 */
export type ArtistSyncState = {
  artistId: number;
  lastFetchedAt?: string;
  lastFetchStatus?: 'ok' | 'error' | 'pending';
  lastFetchError?: string;
  eventsFound: number;
  updatedAt: string;
};

/** 검색 API 가 돌려주는 Raw 결과 */
export type SearchHit = {
  externalId: string;
  name: string;
  nameEn?: string;
  role?: string;
  bio?: string;
  avatarUrl?: string;
  source: string;              // 어떤 프로바이더에서 왔는지
};

/** 파서가 내놓는 통합 결과 — 한 명의 아티스트를 fetch 했을 때 얻어지는 묶음 */
export type ArtistFetchBundle = {
  artist: Omit<Artist, 'id' | 'createdAt' | 'updatedAt' | 'isFollowing' | 'notifyEnabled'> & { externalId: string };
  events: Omit<Event, 'id' | 'artistId' | 'createdAt' | 'updatedAt' | 'notifyEnabled'>[];
  tickets?: Omit<Ticket, 'id' | 'artistId' | 'createdAt' | 'updatedAt' | 'month'>[];
  notifications?: Omit<Notification, 'id' | 'artistId' | 'createdAt' | 'isNew'>[];
};

/** v2: 뱃지 */
export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'special';
  unlocked: boolean;
  unlockedAt?: string;
};
