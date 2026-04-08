"""
Travellog 시드 데이터 스크립트
실행: python3 seed.py
- travellog_official 계정 생성
- 샘플 여행 게시물 20개 생성
- 신규 가입자 자동 팔로우 설정
"""
import sqlite3, uuid, time, json
from pathlib import Path

HOME = Path.home()
DB_PATH = HOME / "projects/spagenio/travel-platform/data/travellog.db"

if not DB_PATH.exists():
    print("❌ DB 파일이 없습니다. 먼저 서버를 실행해주세요.")
    exit(1)

conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA journal_mode=WAL")

# ── 공식 계정 생성 ───────────────────────────────────────
OFFICIAL_ID = "travellog-official"
OFFICIAL_NICK = "Travellog"

existing = conn.execute("SELECT id FROM users WHERE id=?", (OFFICIAL_ID,)).fetchone()
if not existing:
    conn.execute("""
        INSERT INTO users (id, nickname, email, password, profile_image, bio, role, suspended, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'official', 0, ?)
    """, (
        OFFICIAL_ID,
        OFFICIAL_NICK,
        "official@travellog.com",
        "OFFICIAL_ACCOUNT_NO_LOGIN",
        "https://ui-avatars.com/api/?name=TL&background=4f46e5&color=fff&size=200&bold=true",
        "✈️ 전 세계 여행자들의 이야기를 담습니다. 당신의 여행을 공유해보세요!",
        time.strftime("%Y-%m-%dT%H:%M:%S")
    ))
    print("✅ 공식 계정 생성 완료")
else:
    print("ℹ️  공식 계정 이미 존재")

# ── 샘플 게시물 데이터 ───────────────────────────────────
POSTS = [
    {
        "title": "오사카 3박 4일 완벽 여행 코스 🇯🇵",
        "content": "오사카는 정말 먹고 마시고 즐기기 최고의 도시예요! 도톤보리에서 타코야키, 구로몬 시장에서 신선한 해산물, 신세카이에서 쿠시카츠까지. 먹방 여행의 끝판왕입니다.",
        "country": "일본", "city": "오사카",
        "tags": ["일본", "오사카", "먹방여행", "도톤보리", "추천"],
        "images": [
            "https://images.unsplash.com/photo-1590253230532-a67f6bc61c9e?w=800",
            "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800",
        ],
        "places": [
            {"name": "도톤보리", "address": "오사카시 주오구 도톤보리", "lat": 34.6687, "lng": 135.5003, "category": "관광", "howToGet": "난바역 14번 출구 도보 3분", "tip": "저녁 7시 이후 방문 추천! 네온사인이 예뻐요"},
            {"name": "구로몬 시장", "address": "오사카시 주오구 닛폰바시", "lat": 34.6658, "lng": 135.5065, "category": "음식", "howToGet": "닛폰바시역 도보 5분", "tip": "오전 11시~오후 5시 운영"},
        ]
    },
    {
        "title": "파리 일주일, 에펠탑보다 더 좋았던 곳들 🗼",
        "content": "파리 하면 에펠탑만 생각하는데, 사실 파리의 진짜 매력은 골목골목에 있어요. 마레 지구의 팔라펠 맛집, 몽마르트르 언덕에서 바라본 야경, 센강 유람선에서 마신 와인 한 잔...",
        "country": "프랑스", "city": "파리",
        "tags": ["파리", "프랑스", "유럽여행", "에펠탑", "감성여행"],
        "images": [
            "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800",
            "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
        ],
        "places": [
            {"name": "에펠탑", "address": "Champ de Mars, 5 Av. Anatole France, Paris", "lat": 48.8584, "lng": 2.2945, "category": "관광", "howToGet": "메트로 6호선 Bir-Hakeim역 도보 10분", "tip": "밤 10시 매시간 정각에 반짝이는 조명 놓치지 마세요!"},
            {"name": "몽마르트르 언덕", "address": "Montmartre, Paris", "lat": 48.8867, "lng": 2.3431, "category": "관광", "howToGet": "메트로 12호선 Abbesses역", "tip": "케이블카 대신 계단으로 올라가면 파리 전경이 더 멋져요"},
        ]
    },
    {
        "title": "발리 우붓에서 찾은 나만의 힐링 🌿",
        "content": "발리 우붓은 정신없는 꾸따와는 완전히 달라요. 논밭 사이 빌라에서 눈을 떠서 원숭이 숲을 산책하고, 요가 클래스에서 하루를 시작하는 삶. 2주간의 디지털 디톡스를 경험했어요.",
        "country": "인도네시아", "city": "발리",
        "tags": ["발리", "우붓", "힐링여행", "요가", "디지털디톡스"],
        "images": [
            "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
            "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=800",
        ],
        "places": [
            {"name": "우붓 원숭이 숲", "address": "Jl. Monkey Forest, Ubud, Bali", "lat": -8.5185, "lng": 115.2593, "category": "관광", "howToGet": "우붓 중심가에서 도보 15분", "tip": "음식이나 반짝이는 물건 소지 금지!"},
            {"name": "뜨갈랄랑 라이스 테라스", "address": "Tegallalang, Gianyar, Bali", "lat": -8.4349, "lng": 115.2793, "category": "관광", "howToGet": "우붓에서 차로 20분", "tip": "이른 아침 방문시 안개와 어우러진 풍경이 장관"},
        ]
    },
    {
        "title": "뉴욕 첫 방문자를 위한 필수 코스 🗽",
        "content": "뉴욕은 처음엔 압도적으로 느껴질 수 있어요. 하지만 맨해튼 그리드 구조만 파악하면 생각보다 쉽게 돌아다닐 수 있어요. 지하철 1주일 패스 사서 마음껏 돌아다녔습니다!",
        "country": "미국", "city": "뉴욕",
        "tags": ["뉴욕", "미국", "첫방문", "맨해튼", "자유여행"],
        "images": [
            "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800",
            "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800",
        ],
        "places": [
            {"name": "센트럴 파크", "address": "Central Park, New York, NY", "lat": 40.7851, "lng": -73.9683, "category": "관광", "howToGet": "지하철 A,B,C,D선 59th St역", "tip": "자전거 렌트해서 한바퀴 도는 거 강추!"},
            {"name": "타임스퀘어", "address": "Times Square, New York, NY", "lat": 40.7580, "lng": -73.9855, "category": "관광", "howToGet": "지하철 N,Q,R,W선 Times Sq-42 St역", "tip": "저녁에 방문하면 화려한 네온사인 볼 수 있어요"},
        ]
    },
    {
        "title": "방콕 48시간 완전 정복 🇹🇭",
        "content": "경유지로만 생각했던 방콕, 48시간만 있어도 이렇게 많은 걸 볼 수 있다니! 왓 포의 와불상, 짜오프라야강 보트 투어, 카오산로드의 밤문화까지 알차게 즐겼어요.",
        "country": "태국", "city": "방콕",
        "tags": ["방콕", "태국", "짧은여행", "48시간", "사원"],
        "images": [
            "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800",
        ],
        "places": [
            {"name": "왓 포", "address": "2 Sanam Chai Rd, Phra Borom Maha Ratchawang, Bangkok", "lat": 13.7465, "lng": 100.4927, "category": "관광", "howToGet": "왕궁에서 도보 5분", "tip": "입장료 200바트, 무릎과 어깨 가리는 복장 필수"},
        ]
    },
    {
        "title": "이스탄불에서 만난 동서양의 교차점 🕌",
        "content": "유럽과 아시아를 한 도시에서 경험할 수 있다는 게 신기했어요. 아야 소피아에서 압도적인 역사를 느끼고, 그랜드 바자르에서 흥정의 즐거움을, 보스포루스 해협에서 일몰을 봤어요.",
        "country": "터키", "city": "이스탄불",
        "tags": ["이스탄불", "터키", "역사여행", "유럽아시아", "이슬람"],
        "images": [
            "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800",
        ],
        "places": [
            {"name": "아야 소피아", "address": "Sultan Ahmet, Ayasofya Meydanı No:1, İstanbul", "lat": 41.0086, "lng": 28.9802, "category": "관광", "howToGet": "트램 T1 Sultanahmet역 도보 5분", "tip": "무슬림 예배시간에는 일부 구역 제한"},
            {"name": "그랜드 바자르", "address": "Beyazıt, Kalpakçılar Cd., İstanbul", "lat": 41.0105, "lng": 28.9682, "category": "쇼핑", "howToGet": "트램 Beyazıt역 도보 5분", "tip": "제시 가격의 절반부터 흥정 시작!"},
        ]
    },
    {
        "title": "제주도 올레길 완주 도전기 🍊",
        "content": "서울에서 비행기로 1시간, 하지만 완전히 다른 세계예요. 올레길 7코스를 걸으며 제주의 자연을 온몸으로 느꼈어요. 중간에 만난 할망이 주신 귤 한 봉지가 잊혀지질 않아요.",
        "country": "한국", "city": "제주",
        "tags": ["제주도", "올레길", "국내여행", "힐링", "도보여행"],
        "images": [
            "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=800",
        ],
        "places": [
            {"name": "성산일출봉", "address": "제주특별자치도 서귀포시 성산읍 성산리", "lat": 33.4586, "lng": 126.9427, "category": "관광", "howToGet": "제주시외버스터미널에서 성산행 버스", "tip": "일출 보려면 새벽 5시 30분까지는 도착해야 해요"},
        ]
    },
    {
        "title": "바르셀로나, 가우디에 빠진 5일 🏛️",
        "content": "사그라다 파밀리아를 처음 봤을 때 말문이 막혔어요. 140년째 짓고 있는 성당이라니. 구엘 공원의 모자이크, 카사 밀라의 물결치는 외관... 가우디는 정말 다른 차원의 예술가예요.",
        "country": "스페인", "city": "바르셀로나",
        "tags": ["바르셀로나", "스페인", "가우디", "건축여행", "유럽"],
        "images": [
            "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800",
        ],
        "places": [
            {"name": "사그라다 파밀리아", "address": "C/ de Mallorca, 401, Barcelona", "lat": 41.4036, "lng": 2.1744, "category": "관광", "howToGet": "메트로 L2/L5 Sagrada Família역", "tip": "온라인 예매 필수! 당일 구매는 긴 줄 각오해야 해요"},
            {"name": "구엘 공원", "address": "08024 Barcelona", "lat": 41.4145, "lng": 2.1527, "category": "관광", "howToGet": "메트로 L3 Lesseps역에서 도보 20분", "tip": "무료 구역과 유료 구역 구분 있어요"},
        ]
    },
    {
        "title": "교토 단풍 시즌, 최고의 선택이었어요 🍁",
        "content": "11월 교토는 말 그대로 엽서 속 풍경이에요. 아라시야마 대나무숲을 걷고, 기요미즈데라에서 붉게 물든 단풍을 바라보고, 폰토초 골목에서 유부초밥 한 접시... 다시 가고 싶어요.",
        "country": "일본", "city": "교토",
        "tags": ["교토", "일본", "단풍", "가을여행", "전통문화"],
        "images": [
            "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800",
            "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800",
        ],
        "places": [
            {"name": "기요미즈데라", "address": "1-294 Kiyomizu, Higashiyama Ward, Kyoto", "lat": 34.9949, "lng": 135.7851, "category": "관광", "howToGet": "버스 206번 기요미즈미치 정류장에서 도보 15분", "tip": "새벽 6시 개장, 이른 아침이 가장 한적해요"},
            {"name": "아라시야마 대나무숲", "address": "Sagaogurayama Tabuchiyamacho, Ukyo Ward, Kyoto", "lat": 35.0170, "lng": 135.6711, "category": "관광", "howToGet": "란덴 아라시야마역 도보 5분", "tip": "오전 7시 이전 방문시 사람이 없어서 사진 찍기 좋아요"},
        ]
    },
    {
        "title": "두바이 48시간, 사막 위의 도시 🏜️",
        "content": "버즈 칼리파 전망대에서 바라본 두바이는 정말 비현실적이에요. 사막 위에 이렇게 거대한 도시를 만들다니. 사막 사파리에서 낙타 타고 모래언덕 슬라이딩까지!",
        "country": "UAE", "city": "두바이",
        "tags": ["두바이", "UAE", "버즈칼리파", "사막", "럭셔리여행"],
        "images": [
            "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800",
        ],
        "places": [
            {"name": "버즈 칼리파", "address": "1 Sheikh Mohammed bin Rashid Blvd, Dubai", "lat": 25.1972, "lng": 55.2744, "category": "관광", "howToGet": "메트로 레드라인 Burj Khalifa/Dubai Mall역", "tip": "일몰 30분 전 방문시 낮과 밤 모두 감상 가능"},
        ]
    },
    {
        "title": "하노이 구시가지 골목 탐방 🍜",
        "content": "하노이 구시가지 36개 거리는 각각 다른 상품을 파는 골목이에요. 실크 골목, 종이 골목, 주석 골목... 미로처럼 복잡한 골목을 헤매다 발견한 분짜 집이 진짜 최고였어요.",
        "country": "베트남", "city": "하노이",
        "tags": ["하노이", "베트남", "구시가지", "로컬맛집", "동남아"],
        "images": [
            "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
        ],
        "places": [
            {"name": "호안끼엠 호수", "address": "Hoan Kiem Lake, Hang Trong, Hoan Kiem, Hanoi", "lat": 21.0285, "lng": 105.8524, "category": "관광", "howToGet": "구시가지에서 도보 10분", "tip": "주말 저녁엔 차 없는 거리 축제가 열려요"},
        ]
    },
    {
        "title": "산토리니, 그 파란 지붕 아래 🇬🇷",
        "content": "산토리니는 기대를 절대 배신하지 않는 곳이에요. 이아 마을의 새하얀 건물과 파란 지붕, 그리고 에게해 너머로 지는 석양... 인생 사진 1000장은 기본으로 찍고 왔어요.",
        "country": "그리스", "city": "산토리니",
        "tags": ["산토리니", "그리스", "유럽여행", "이아마을", "석양"],
        "images": [
            "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800",
        ],
        "places": [
            {"name": "이아 마을", "address": "Oia, Santorini", "lat": 36.4618, "lng": 25.3753, "category": "관광", "howToGet": "피라에서 버스 25분 또는 ATV 렌트", "tip": "석양 명당 자리는 2시간 전에 선점해야 해요"},
        ]
    },
    {
        "title": "시드니 서퍼스 파라다이스 🏄‍♂️",
        "content": "본다이 비치에서 서핑 레슨을 받았어요. 처음엔 계속 넘어졌는데 마지막엔 파도를 탔을 때의 그 짜릿함! 오페라하우스 앞에서 마신 맥주 한 캔도 잊을 수 없어요.",
        "country": "호주", "city": "시드니",
        "tags": ["시드니", "호주", "본다이비치", "서핑", "오페라하우스"],
        "images": [
            "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800",
        ],
        "places": [
            {"name": "본다이 비치", "address": "Bondi Beach, NSW, Australia", "lat": -33.8915, "lng": 151.2767, "category": "해변", "howToGet": "시티에서 버스 333번", "tip": "서핑 레슨 $60~80 AUD, 보드 렌탈 포함"},
            {"name": "시드니 오페라하우스", "address": "Bennelong Point, Sydney NSW", "lat": -33.8568, "lng": 151.2153, "category": "관광", "howToGet": "서큘라 키 역에서 도보 5분", "tip": "내부 투어 꼭 해보세요, 외관보다 내부가 더 인상적"},
        ]
    },
    {
        "title": "모로코 마라케시, 미로 속으로 🧡",
        "content": "제마 엘프나 광장의 혼돈, 수크의 향신료 향기, 야디 마조렐의 코발트 블루... 모로코는 감각을 모두 깨우는 나라예요. 리아드에서의 하룻밤도 정말 특별했어요.",
        "country": "모로코", "city": "마라케시",
        "tags": ["모로코", "마라케시", "아프리카", "이색여행", "수크"],
        "images": [
            "https://images.unsplash.com/photo-1539020140153-e479b8ebb8c6?w=800",
        ],
        "places": [
            {"name": "제마 엘프나 광장", "address": "Place Jemaa el-Fna, Marrakech", "lat": 31.6258, "lng": -7.9891, "category": "관광", "howToGet": "구시가지 중심부, 택시 이용 권장", "tip": "저녁엔 야외 식당 파라솔이 펼쳐지며 더욱 활기차요"},
        ]
    },
    {
        "title": "프라하 황금의 도시를 걷다 🏰",
        "content": "체코 프라하는 중세 동화 속 도시 그 자체예요. 카를교 위에서 바라본 프라하 성, 구시가지 광장의 천문시계... 물가도 저렴하고 맥주도 맛있어서 유럽 여행의 숨겨진 보석이에요.",
        "country": "체코", "city": "프라하",
        "tags": ["프라하", "체코", "중세도시", "동유럽", "성당"],
        "images": [
            "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800",
        ],
        "places": [
            {"name": "카를교", "address": "Karlův most, 110 00 Praha", "lat": 50.0865, "lng": 14.4114, "category": "관광", "howToGet": "구시가지 광장에서 도보 10분", "tip": "새벽 6시 이전에 오면 안개와 조용한 분위기 즐길 수 있어요"},
        ]
    },
    {
        "title": "홍콩 야경, 세계 최고라더니 진짜네 🌃",
        "content": "빅토리아 피크에서 바라본 홍콩 야경은 정말 최고였어요. 센트럴의 마천루와 구룡반도가 만들어내는 스카이라인은 사진으로는 절대 담을 수 없는 감동이에요.",
        "country": "홍콩", "city": "홍콩",
        "tags": ["홍콩", "야경", "빅토리아피크", "딤섬", "아시아"],
        "images": [
            "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800",
        ],
        "places": [
            {"name": "빅토리아 피크", "address": "The Peak, Hong Kong", "lat": 22.2759, "lng": 114.1455, "category": "관광", "howToGet": "센트럴 피크 트램 터미널에서 트램 탑승", "tip": "날씨 확인 필수! 안개 끼는 날엔 아무것도 안 보여요"},
        ]
    },
    {
        "title": "리스본에서 파두 음악에 취한 밤 🎵",
        "content": "포르투갈 리스본은 언덕과 트램, 그리고 파두 음악의 도시예요. 알파마 지구의 좁은 골목에서 들려오는 파두 선율에 발걸음을 멈추고 한참을 서 있었어요.",
        "country": "포르투갈", "city": "리스본",
        "tags": ["리스본", "포르투갈", "파두", "유럽여행", "트램"],
        "images": [
            "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",
        ],
        "places": [
            {"name": "벨렘 탑", "address": "Av. Brasília, 1400-038 Lisboa", "lat": 38.6916, "lng": -9.2160, "category": "관광", "howToGet": "트램 15E 벨렘역", "tip": "유네스코 세계문화유산, 방문 시 여권 지참"},
        ]
    },
    {
        "title": "싱가포르 슈퍼트리 아래서 🌳",
        "content": "싱가포르는 작지만 알차요. 마리나 베이 샌즈 수영장, 가든스 바이 더 베이, 호커 센터의 저렴하고 맛있는 음식들... 3박 4일이 어떻게 지나갔는지 모를 정도로 바빴어요.",
        "country": "싱가포르", "city": "싱가포르",
        "tags": ["싱가포르", "마리나베이샌즈", "가든스바이더베이", "호커센터"],
        "images": [
            "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800",
        ],
        "places": [
            {"name": "가든스 바이 더 베이", "address": "18 Marina Gardens Dr, Singapore", "lat": 1.2816, "lng": 103.8636, "category": "관광", "howToGet": "MRT 베이프런트역 도보 5분", "tip": "슈퍼트리 쇼는 저녁 7:45, 8:45 두 번 진행돼요"},
        ]
    },
    {
        "title": "아이슬란드 오로라를 맨눈으로 봤어요 🌌",
        "content": "평생 한번은 봐야 한다는 오로라, 드디어 봤어요. 레이캬비크에서 차로 1시간 거리 어두운 들판에서 갑자기 하늘이 초록색으로 물들기 시작했을 때... 소름이 돋았어요.",
        "country": "아이슬란드", "city": "레이캬비크",
        "tags": ["아이슬란드", "오로라", "버킷리스트", "겨울여행", "자연"],
        "images": [
            "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800",
        ],
        "places": [
            {"name": "할그림스키르캬 교회", "address": "Hallgrímstorg 101, Reykjavík", "lat": 64.1418, "lng": -21.9264, "category": "관광", "howToGet": "레이캬비크 시내 도보 가능", "tip": "꼭대기 전망대에서 도시 전경 감상 추천"},
        ]
    },
    {
        "title": "나폴리에서 진짜 피자를 먹다 🍕",
        "content": "피자의 본고장 나폴리에서 먹은 마르게리타 피자는 정말 달랐어요. 얇고 쫄깃한 도우, 신선한 모짜렐라, 진한 토마토소스... 한국에서 먹던 피자는 이제 피자가 아닌 것 같아요.",
        "country": "이탈리아", "city": "나폴리",
        "tags": ["나폴리", "이탈리아", "피자", "음식여행", "유럽"],
        "images": [
            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800",
        ],
        "places": [
            {"name": "다 미켈레 피자리아", "address": "Via Cesare Sersale, 1, 80139 Napoli", "lat": 40.8488, "lng": 14.2674, "category": "음식", "howToGet": "나폴리 중앙역에서 도보 15분", "tip": "번호표 뽑고 기다리는 시스템, 1시간 대기는 기본"},
        ]
    },
]

# ── 게시물 삽입 ───────────────────────────────────────────
# 기존 게시물 확인
existing_count = conn.execute("SELECT COUNT(*) FROM posts WHERE user_id=?", (OFFICIAL_ID,)).fetchone()[0]
if existing_count > 0:
    print(f"ℹ️  공식 계정 게시물 이미 {existing_count}개 존재, 건너뜁니다.")
else:
    now_ts = int(time.time())
    for i, post in enumerate(POSTS):
        post_id = str(uuid.uuid4()).replace("-", "")[:12]
        created_at = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now_ts - (len(POSTS) - i) * 3600 * 24))

        # posts 테이블
        conn.execute("""
            INSERT INTO posts (id, user_id, user_nickname, user_profile_image, title, content, country, city, created_at, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')
        """, (
            post_id, OFFICIAL_ID, OFFICIAL_NICK,
            "https://ui-avatars.com/api/?name=TL&background=4f46e5&color=fff&size=200&bold=true",
            post["title"], post["content"], post["country"], post["city"], created_at
        ))

        # 이미지
        for img_url in post.get("images", []):
            conn.execute("INSERT INTO post_images (post_id, image_url) VALUES (?, ?)", (post_id, img_url))

        # 태그
        for tag in post.get("tags", []):
            conn.execute("INSERT INTO post_tags (post_id, tag) VALUES (?, ?)", (post_id, tag))

        # 장소
        for j, place in enumerate(post.get("places", [])):
            place_id = str(uuid.uuid4()).replace("-", "")[:12]
            conn.execute("""
                INSERT INTO places (id, post_id, place_order, name, address, lat, lng, category, how_to_get, tip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                place_id, post_id, j+1,
                place.get("name", ""), place.get("address", ""),
                place.get("lat", 0), place.get("lng", 0),
                place.get("category", "관광"),
                place.get("howToGet", ""), place.get("tip", "")
            ))

    conn.commit()
    print(f"✅ 샘플 게시물 {len(POSTS)}개 생성 완료")

conn.close()
print("\n🎉 시드 데이터 설정 완료!")
print("📌 신규 가입자는 자동으로 공식 계정을 팔로우하도록 Python main.py에 설정해주세요.")
