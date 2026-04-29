/**
 * 시나리오별 패킹 템플릿
 * 사용처: 체크리스트 만들 때 한 번에 다수 항목 추가
 */

import type { ChecklistCategory } from '@/types';

export interface PackingItem {
  title: string;
  category: ChecklistCategory;
}

export interface PackingScenario {
  id: string;
  icon: string;
  label: string;
  description: string;
  items: PackingItem[];
}

export const PACKING_SCENARIOS: PackingScenario[] = [
  {
    id: 'beach',
    icon: '🏖',
    label: '해변·휴양',
    description: '발리·세부·푸켓·다낭·괌·하와이',
    items: [
      { title: '여권', category: 'document' },
      { title: '전자 항공권', category: 'document' },
      { title: '여행자 보험 증서', category: 'document' },
      { title: '수영복 (2벌)', category: 'clothing' },
      { title: '래시가드', category: 'clothing' },
      { title: '비치 샌들', category: 'clothing' },
      { title: '얇은 긴 옷 (저녁용)', category: 'clothing' },
      { title: '모자·선글라스', category: 'clothing' },
      { title: '비치 타월', category: 'clothing' },
      { title: '선크림 SPF 50+', category: 'toiletries' },
      { title: '애프터 선·알로에', category: 'toiletries' },
      { title: '방수 가방 (드라이백)', category: 'general' },
      { title: '스노클링 마스크 (선택)', category: 'general' },
      { title: '방수 폰 케이스', category: 'electronics' },
      { title: '보조 배터리', category: 'electronics' },
      { title: '110V 어댑터', category: 'electronics' },
      { title: '두통약·소화제', category: 'medicine' },
      { title: '지사제·정장제', category: 'medicine' },
      { title: '모기 기피제', category: 'medicine' },
    ],
  },
  {
    id: 'winter',
    icon: '❄️',
    label: '겨울·스키',
    description: '삿포로·강원도·유럽 겨울',
    items: [
      { title: '여권', category: 'document' },
      { title: '전자 항공권', category: 'document' },
      { title: '롱 패딩', category: 'clothing' },
      { title: '히트텍 상하 (2세트)', category: 'clothing' },
      { title: '플리스/니트', category: 'clothing' },
      { title: '방수 부츠', category: 'clothing' },
      { title: '장갑·털모자', category: 'clothing' },
      { title: '목도리', category: 'clothing' },
      { title: '두꺼운 양말 (3쌍)', category: 'clothing' },
      { title: '핫팩 (10개)', category: 'general' },
      { title: '립밤·핸드크림', category: 'toiletries' },
      { title: '보습 크림', category: 'toiletries' },
      { title: '선크림 (설원 반사)', category: 'toiletries' },
      { title: '보조 배터리 (저온 빨리 닳음)', category: 'electronics' },
      { title: '110V 어댑터', category: 'electronics' },
      { title: '감기약', category: 'medicine' },
      { title: '진통제', category: 'medicine' },
      { title: '스키 장비 (대여 시 생략)', category: 'general' },
    ],
  },
  {
    id: 'city',
    icon: '🏙',
    label: '도시 관광',
    description: '도쿄·파리·뉴욕·런던',
    items: [
      { title: '여권', category: 'document' },
      { title: '전자 항공권', category: 'document' },
      { title: '신용카드 (2개)', category: 'document' },
      { title: '편한 운동화', category: 'clothing' },
      { title: '캐주얼 상의 (3-4벌)', category: 'clothing' },
      { title: '바지 (2벌)', category: 'clothing' },
      { title: '가벼운 자켓', category: 'clothing' },
      { title: '속옷·양말 (일수+1)', category: 'clothing' },
      { title: '잠옷', category: 'clothing' },
      { title: '에코백/숄더백', category: 'general' },
      { title: '우산 (접이식)', category: 'general' },
      { title: '치약·칫솔', category: 'toiletries' },
      { title: '클렌저', category: 'toiletries' },
      { title: '보조 배터리', category: 'electronics' },
      { title: '국가별 어댑터', category: 'electronics' },
      { title: '데이터 eSIM/유심', category: 'electronics' },
      { title: '진통제', category: 'medicine' },
      { title: '소화제', category: 'medicine' },
    ],
  },
  {
    id: 'trekking',
    icon: '🥾',
    label: '트레킹·자연',
    description: '산·국립공원·캠핑',
    items: [
      { title: '여권', category: 'document' },
      { title: '여행자 보험 (응급 의료 포함)', category: 'document' },
      { title: '등산화', category: 'clothing' },
      { title: '기능성 등산복 상하', category: 'clothing' },
      { title: '방수 자켓', category: 'clothing' },
      { title: '등산 양말 (3쌍)', category: 'clothing' },
      { title: '모자·선글라스', category: 'clothing' },
      { title: '배낭 (30L+)', category: 'general' },
      { title: '물통 (1L+)', category: 'general' },
      { title: '렌턴/헤드램프', category: 'general' },
      { title: '에너지바·견과류', category: 'general' },
      { title: '선크림', category: 'toiletries' },
      { title: '벌레 기피제', category: 'toiletries' },
      { title: '구급 키트', category: 'medicine' },
      { title: '근육 진통제', category: 'medicine' },
      { title: '발 물집 패치', category: 'medicine' },
      { title: '보조 배터리 (대용량)', category: 'electronics' },
    ],
  },
  {
    id: 'business',
    icon: '💼',
    label: '출장',
    description: '비즈니스·짧은 일정',
    items: [
      { title: '여권', category: 'document' },
      { title: '전자 항공권', category: 'document' },
      { title: '명함 (충분히)', category: 'document' },
      { title: '회사 출장 서류', category: 'document' },
      { title: '정장 한 벌', category: 'clothing' },
      { title: '셔츠 (일수)', category: 'clothing' },
      { title: '구두 + 캐주얼화', category: 'clothing' },
      { title: '넥타이 (2개)', category: 'clothing' },
      { title: '실내복', category: 'clothing' },
      { title: '노트북 + 충전기', category: 'electronics' },
      { title: '발표용 어댑터 (HDMI 등)', category: 'electronics' },
      { title: '보조 배터리', category: 'electronics' },
      { title: '국가별 어댑터', category: 'electronics' },
      { title: '면도기·면도크림', category: 'toiletries' },
      { title: '치약·칫솔', category: 'toiletries' },
      { title: '진통제', category: 'medicine' },
      { title: '시차 적응 약 (멜라토닌 등)', category: 'medicine' },
    ],
  },
];
