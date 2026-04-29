/**
 * 도메인 타입 정의
 */

export interface User {
  id: number;
  nickname: string;
  email: string | null;
  nationality: string | null;
  profileImage: string | null;
  homeCurrency: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = 'planning' | 'ongoing' | 'completed';

export interface Trip {
  id: number;
  title: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  cityId: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  currency: string;
  status: TripStatus;
  coverImage: string | null;
  memo: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TripItemCategory =
  | 'sightseeing'
  | 'food'
  | 'activity'
  | 'accommodation'
  | 'transport'
  | 'shopping'
  | 'other';

export interface TripItem {
  id: number;
  tripId: number;
  day: number;
  startTime: string | null;
  endTime: string | null;
  title: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  memo: string | null;
  cost: number;
  currency: string | null;
  category: TripItemCategory;
  isDone: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface TripLog {
  id: number;
  tripId: number;
  logDate: string;
  title: string | null;
  content: string | null;
  images: string[];
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  weather: string | null;
  mood: string | null;
  createdAt: string;
  updatedAt: string;
}

// schema.ts / receiptParser.ts와 일치 (activity + entertainment 모두 포함)
export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'activity'
  | 'entertainment'
  | 'shopping'
  | 'sightseeing'
  | 'other';

export interface Expense {
  id: number;
  tripId: number;
  expenseDate: string;
  category: ExpenseCategory;
  title: string | null;
  amount: number;
  currency: string;
  amountInHomeCurrency: number | null;
  exchangeRate: number | null;
  paymentMethod: string | null;
  memo: string | null;
  // 영수증 관련 (schema v3)
  receiptImage: string | null;
  receiptOcrText: string | null;
  receiptConfidence: number | null;
  ocrEngine: string | null;
  createdAt: string;
}

export type ChecklistCategory =
  | 'document'
  | 'clothing'
  | 'electronics'
  | 'toiletries'
  | 'medicine'
  | 'general';

export interface ChecklistItem {
  id: number;
  tripId: number;
  title: string;
  category: ChecklistCategory;
  isChecked: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ExchangeRate {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  updatedAt: string;
}

export interface Bookmark {
  id: number;
  title: string;
  description: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  image: string | null;
  url: string | null;
  createdAt: string;
}

export type TicketCategory =
  | 'flight'
  | 'train'
  | 'bus'
  | 'attraction'
  | 'show'
  | 'other';

export interface Ticket {
  id: number;
  tripId: number | null;
  category: TicketCategory;
  title: string;
  useDate: string | null;
  origin: string | null;
  destination: string | null;
  seat: string | null;
  amount: number | null;
  currency: string | null;
  imageUri: string;
  ocrText: string | null;
  memo: string | null;
  createdAt: string;
}
