-- ============================================================
-- Travellog 초기 시드 데이터
-- 사용법:
--   1. bash start-all.sh 으로 서버 시작 후 stop-all.sh 종료
--   2. sqlite3 ~/projects/spagenio/travel-platform/data/travellog.db < init_db.sql
--   3. bash start-all.sh 재시작
-- ============================================================

-- ── 마이그레이션 (에러 나도 무시) ──
ALTER TABLE plans ADD COLUMN share_type TEXT DEFAULT 'private';
ALTER TABLE plans ADD COLUMN share_schedule INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN share_places INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS plan_members (
    id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, user_id TEXT,
    user_nickname TEXT, user_profile_image TEXT, role TEXT DEFAULT 'member', joined_at TEXT
);
CREATE TABLE IF NOT EXISTS plan_messages (
    id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, user_id TEXT,
    user_nickname TEXT, user_profile_image TEXT, content TEXT, type TEXT DEFAULT 'text', created_at TEXT
);

-- ── 유저 (비밀번호: test1234) ──
INSERT OR IGNORE INTO users (id, nickname, email, password, profile_image, bio, role, suspended, agree_marketing, visited_countries, created_at, default_feed) VALUES
('u001','travel_kim',   'kim@test.com',     'test1234','https://ui-avatars.com/api/?name=TK&background=4f46e5&color=fff&size=80','일본 소도시 여행을 좋아해요 🇯🇵','user', 0,1, 8,'2025-11-01T09:00:00','all'),
('u002','euro_park',    'park@test.com',    'test1234','https://ui-avatars.com/api/?name=EP&background=10b981&color=fff&size=80','유럽 배낭여행 5회차 ✈️','user',           0,1,22,'2025-11-05T10:00:00','all'),
('u003','asia_lee',     'lee@test.com',     'test1234','https://ui-avatars.com/api/?name=AL&background=f59e0b&color=fff&size=80','동남아 전문 여행러 🌴','user',            0,0,15,'2025-11-10T11:00:00','all'),
('u004','foodie_choi',  'choi@test.com',    'test1234','https://ui-avatars.com/api/?name=FC&background=ef4444&color=fff&size=80','맛집 탐방이 곧 여행 🍜','user',           0,1, 5,'2025-11-15T12:00:00','all'),
('u005','photo_jung',   'jung@test.com',    'test1234','https://ui-avatars.com/api/?name=PJ&background=8b5cf6&color=fff&size=80','여행 사진작가 📸','user',               0,1,30,'2025-11-20T13:00:00','all'),
('u006','cafe_yoon',    'yoon@test.com',    'test1234','https://ui-avatars.com/api/?name=CY&background=ec4899&color=fff&size=80','카페 투어 전문 ☕','user',               0,0, 3,'2025-12-01T09:00:00','all'),
('u007','hiking_oh',    'oh@test.com',      'test1234','https://ui-avatars.com/api/?name=HO&background=16a34a&color=fff&size=80','자연 & 트레킹 러버 🏔️','user',          0,1,12,'2025-12-05T10:00:00','all'),
('u008','luxury_han',   'han@test.com',     'test1234','https://ui-avatars.com/api/?name=LH&background=d97706&color=fff&size=80','럭셔리 여행 추구 ✨','user',             0,1,20,'2025-12-10T11:00:00','all'),
('u009','backpack_lim', 'lim@test.com',     'test1234','https://ui-avatars.com/api/?name=BL&background=0ea5e9&color=fff&size=80','배낭 하나로 세계 일주 중 🌍','user',      0,0,45,'2025-12-15T12:00:00','all'),
('u010','admin',        'admin@test.com',   'admin1234','https://ui-avatars.com/api/?name=AD&background=1a1a2e&color=fff&size=80','관리자','admin',                         0,1, 0,'2025-10-01T00:00:00','all'),
('u011','round74',      'round74@test.com', 'test1234','https://ui-avatars.com/api/?name=RO&background=4f46e5&color=fff&size=80','테스트 계정','user',                      0,0, 0,'2025-10-01T00:00:00','all');

-- ── 팔로우 ──
INSERT OR IGNORE INTO user_following (user_id, following_id) VALUES
('u001','u002'),('u001','u003'),('u001','u005'),
('u002','u001'),('u002','u004'),('u002','u007'),
('u003','u001'),('u003','u002'),('u003','u006'),
('u004','u001'),('u004','u003'),('u004','u008'),
('u005','u002'),('u005','u003'),('u005','u009');
INSERT OR IGNORE INTO user_followers (user_id, follower_id) VALUES
('u002','u001'),('u003','u001'),('u005','u001'),
('u001','u002'),('u004','u002'),('u007','u002'),
('u001','u003'),('u002','u003'),('u006','u003'),
('u001','u004'),('u003','u004'),('u008','u004'),
('u002','u005'),('u003','u005'),('u009','u005');

-- ── 게시물 ──
INSERT OR IGNORE INTO posts (id, user_id, user_nickname, user_profile_image, title, content, country, city, created_at, visibility) VALUES
('p001','u001','travel_kim',  'https://ui-avatars.com/api/?name=TK&background=4f46e5&color=fff','오사카 3박4일 완벽 가이드','도톤보리에서 타코야키를 먹고 유니버설 스튜디오도 다녀왔어요. 난바역 근처 호텔이 교통이 편리해서 추천해요!','일본','오사카','2026-03-01T10:00:00','public'),
('p002','u002','euro_park',   'https://ui-avatars.com/api/?name=EP&background=10b981&color=fff','파리 에펠탑 야경 포인트 TOP3','트로카데로 광장, 비르아켐 다리, 샹 드 마르스 공원. 각각 다른 매력이 있어요. 비르아켐 다리는 새벽에 가면 인생샷 보장!','프랑스','파리','2026-03-03T14:00:00','public'),
('p003','u003','asia_lee',    'https://ui-avatars.com/api/?name=AL&background=f59e0b&color=fff','방콕 카페 투어 A to Z','아리 지구의 숨겨진 카페들을 소개해요. Ceresia, Factory Coffee가 특히 좋았어요.','태국','방콕','2026-03-05T09:00:00','public'),
('p004','u004','foodie_choi', 'https://ui-avatars.com/api/?name=FC&background=ef4444&color=fff','도쿄 라멘 성지 순례','이치란, 후쿠오카계 라멘, 삿포로계 미소 라멘까지. 신주쿠 골든가이에서 마무리하면 완벽한 하루!','일본','도쿄','2026-03-07T18:00:00','public'),
('p005','u005','photo_jung',  'https://ui-avatars.com/api/?name=PJ&background=8b5cf6&color=fff','바르셀로나 사진 명소 가이드','사그라다 파밀리아 아침 빛, 구엘 공원 황금시간대, 보케리아 시장 컬러풀한 상점들.','스페인','바르셀로나','2026-03-08T11:00:00','public'),
('p006','u006','cafe_yoon',   'https://ui-avatars.com/api/?name=CY&background=ec4899&color=fff','교토 긴카쿠지 & 철학의 길','아침 일찍 가면 관광객 없이 조용하게 즐길 수 있어요. 말차 한 잔이 꿀!','일본','교토','2026-03-10T08:00:00','public'),
('p007','u007','hiking_oh',   'https://ui-avatars.com/api/?name=HO&background=16a34a&color=fff','스위스 인터라켄 융프라우 등반기','융프라우요흐 전망대에서 본 알프스는 평생 잊을 수 없어요. 산악열차 예약 필수!','스위스','인터라켄','2026-03-12T07:00:00','public'),
('p008','u008','luxury_han',  'https://ui-avatars.com/api/?name=LH&background=d97706&color=fff','두바이 버즈 칼리파 & 럭셔리 호텔','아트모스피어 레스토랑에서의 디너는 정말 특별했어요. 버즈 알 아랍 로비 투어도 추천.','아랍에미리트','두바이','2026-03-14T20:00:00','public'),
('p009','u009','backpack_lim','https://ui-avatars.com/api/?name=BL&background=0ea5e9&color=fff','인도 바라나시 갠지스강 일출','새벽 5시 보트를 타고 갠지스강 일출을 봤어요. 삶과 죽음이 공존하는 신비로운 도시.','인도','바라나시','2026-03-15T05:00:00','public'),
('p010','u001','travel_kim',  'https://ui-avatars.com/api/?name=TK&background=4f46e5&color=fff','나라 사슴공원 & 도다이지','사슴들이 먼저 다가와서 당황했어요 😂 도다이지 대불은 규모가 어마어마해요.','일본','나라','2026-03-18T10:00:00','public'),
('p011','u002','euro_park',   'https://ui-avatars.com/api/?name=EP&background=10b981&color=fff','프라하 구시가지 야경','카를교에서 본 프라하 성 야경은 유럽 최고! 체코 맥주도 맛있고 물가도 저렴해요.','체코','프라하','2026-03-20T21:00:00','public'),
('p012','u003','asia_lee',    'https://ui-avatars.com/api/?name=AL&background=f59e0b&color=fff','발리 우붓 라이스테라스 트레킹','떼갈랄랑 라이스테라스에서 바라본 풍경이 장관이에요. 스파도 저렴하고 퀄리티 높아요.','인도네시아','발리','2026-03-22T07:00:00','public'),
('p013','u004','foodie_choi', 'https://ui-avatars.com/api/?name=FC&background=ef4444&color=fff','홍콩 딤섬 맛집 탐방','팀호완, 린헝 티하우스가 최고였어요. 홍콩식 밀크티도 꼭 드셔보세요.','홍콩','홍콩','2026-03-25T11:00:00','public'),
('p014','u005','photo_jung',  'https://ui-avatars.com/api/?name=PJ&background=8b5cf6&color=fff','아이슬란드 오로라 촬영 팁','ISO 800, f2.8, 셔터 15초가 기본 세팅. 날씨 앱 필수! 레이캬비크에서 2시간 거리.','아이슬란드','레이캬비크','2026-03-28T23:00:00','public'),
('p015','u006','cafe_yoon',   'https://ui-avatars.com/api/?name=CY&background=ec4899&color=fff','싱가포르 마리나베이샌즈 인피니티풀','숙박객만 입장 가능하지만 딱 한번은 꼭 경험해볼 것! 루프탑 야경이 압도적이에요.','싱가포르','싱가포르','2026-04-01T19:00:00','public'),
('p016','u007','hiking_oh',   'https://ui-avatars.com/api/?name=HO&background=16a34a&color=fff','뉴질랜드 밀포드 사운드 크루즈','세계 8대 절경 중 하나. 빙하가 깎아만든 피오르드 지형이 경이로워요!','뉴질랜드','퀸스타운','2026-04-03T08:00:00','public'),
('p017','u008','luxury_han',  'https://ui-avatars.com/api/?name=LH&background=d97706&color=fff','몰디브 수상 방갈로 솔직 후기','가격 대비 만족도 100점. 허니문 강력 추천!','몰디브','말레','2026-04-05T06:00:00','public'),
('p018','u009','backpack_lim','https://ui-avatars.com/api/?name=BL&background=0ea5e9&color=fff','모로코 사하라 사막 캠핑','낙타 타고 사막 캠핑. 별이 쏟아지는 밤하늘은 평생 기억에 남아요.','모로코','마라케시','2026-04-06T18:00:00','public'),
('p019','u001','travel_kim',  'https://ui-avatars.com/api/?name=TK&background=4f46e5&color=fff','후쿠오카 당일치기 코스','하카타역 → 나카스 포장마차 → 오호리 공원 → 모츠나베. 부산에서 페리로도 갈 수 있어요!','일본','후쿠오카','2026-04-07T12:00:00','public'),
('p020','u002','euro_park',   'https://ui-avatars.com/api/?name=EP&background=10b981&color=fff','로마 1일 코스 총정리','콜로세움 → 포로 로마노 → 트레비 분수 → 스페인 계단 → 바티칸. 걸어서 다 가능!','이탈리아','로마','2026-04-08T09:00:00','public');

-- ── 게시물 이미지 (Unsplash 무료 이미지) ──
INSERT OR IGNORE INTO post_images (post_id, image_url) VALUES
('p001','https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800'),
('p001','https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800'),
('p002','https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800'),
('p002','https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800'),
('p003','https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800'),
('p003','https://images.unsplash.com/photo-1559628232-ffd9f5d7ef58?w=800'),
('p004','https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800'),
('p004','https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800'),
('p005','https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800'),
('p005','https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800'),
('p006','https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800'),
('p006','https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?w=800'),
('p007','https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800'),
('p007','https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'),
('p008','https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800'),
('p008','https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800'),
('p009','https://images.unsplash.com/photo-1561361058-c24e022cc83d?w=800'),
('p010','https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800'),
('p010','https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800'),
('p011','https://images.unsplash.com/photo-1541849546-216549ae216d?w=800'),
('p011','https://images.unsplash.com/photo-1592906209472-a36b1f3782ef?w=800'),
('p012','https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800'),
('p012','https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=800'),
('p013','https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800'),
('p013','https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800'),
('p014','https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800'),
('p014','https://images.unsplash.com/photo-1504700610630-ac6aba3536d3?w=800'),
('p015','https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800'),
('p015','https://images.unsplash.com/photo-1565967511849-76a60a516170?w=800'),
('p016','https://images.unsplash.com/photo-1529108190281-9a4f620bc2d8?w=800'),
('p016','https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800'),
('p017','https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800'),
('p017','https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800'),
('p018','https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800'),
('p018','https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800'),
('p019','https://images.unsplash.com/photo-1601823984263-b87b59798b70?w=800'),
('p020','https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800'),
('p020','https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800');

-- ── 태그 ──
INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES
('p001','일본'),('p001','오사카'),('p001','맛집'),('p001','쇼핑'),
('p002','프랑스'),('p002','파리'),('p002','야경'),('p002','에펠탑'),
('p003','태국'),('p003','방콕'),('p003','카페'),('p003','감성'),
('p004','일본'),('p004','도쿄'),('p004','맛집'),('p004','라멘'),
('p005','스페인'),('p005','바르셀로나'),('p005','건축'),('p005','사진'),
('p006','일본'),('p006','교토'),('p006','전통'),('p006','카페'),
('p007','스위스'),('p007','등산'),('p007','자연'),('p007','알프스'),
('p008','두바이'),('p008','럭셔리'),('p008','쇼핑'),('p008','호텔'),
('p009','인도'),('p009','배낭여행'),('p009','문화'),('p009','힐링'),
('p010','일본'),('p010','나라'),('p010','동물'),('p010','당일치기'),
('p011','유럽'),('p011','프라하'),('p011','야경'),('p011','맥주'),
('p012','인도네시아'),('p012','발리'),('p012','자연'),('p012','트레킹'),
('p013','홍콩'),('p013','맛집'),('p013','딤섬'),('p013','미식'),
('p014','아이슬란드'),('p014','오로라'),('p014','사진'),('p014','겨울'),
('p015','싱가포르'),('p015','호텔'),('p015','야경'),('p015','럭셔리'),
('p016','뉴질랜드'),('p016','자연'),('p016','크루즈'),('p016','트레킹'),
('p017','몰디브'),('p017','허니문'),('p017','럭셔리'),('p017','바다'),
('p018','모로코'),('p018','사막'),('p018','캠핑'),('p018','배낭여행'),
('p019','일본'),('p019','후쿠오카'),('p019','맛집'),('p019','당일치기'),
('p020','이탈리아'),('p020','로마'),('p020','역사'),('p020','유럽');

-- ── 좋아요 ──
INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES
('p001','u002'),('p001','u003'),('p001','u004'),('p001','u005'),
('p002','u001'),('p002','u003'),('p002','u006'),
('p003','u001'),('p003','u002'),('p003','u007'),
('p004','u002'),('p004','u005'),('p004','u006'),
('p005','u001'),('p005','u003'),('p005','u004'),('p005','u008'),
('p006','u002'),('p006','u004'),('p006','u009'),
('p007','u001'),('p007','u003'),('p007','u005'),
('p008','u002'),('p008','u004'),('p008','u006'),
('p009','u001'),('p009','u007'),('p009','u008'),
('p010','u002'),('p010','u003'),('p010','u004'),
('p011','u001'),('p011','u005'),('p011','u006'),
('p012','u002'),('p012','u007'),('p012','u008'),
('p013','u001'),('p013','u003'),('p013','u009'),
('p014','u002'),('p014','u004'),('p014','u005'),
('p015','u001'),('p015','u006'),('p015','u007'),
('p016','u003'),('p016','u005'),('p016','u008'),
('p017','u001'),('p017','u004'),('p017','u009'),
('p018','u002'),('p018','u006'),('p018','u007'),
('p019','u003'),('p019','u005'),('p019','u008'),
('p020','u001'),('p020','u004'),('p020','u009');

-- ── 댓글 ──
INSERT OR IGNORE INTO comments (id, post_id, user_id, user_nickname, user_profile_image, content, created_at) VALUES
('c001','p001','u002','euro_park',   'https://ui-avatars.com/api/?name=EP&background=10b981&color=fff','도톤보리 타코야키 저도 먹었는데 진짜 맛있었어요!','2026-03-01T12:00:00'),
('c002','p001','u004','foodie_choi', 'https://ui-avatars.com/api/?name=FC&background=ef4444&color=fff','난바역 근처 어느 호텔 묵으셨어요? 추천 부탁드려요~','2026-03-01T14:00:00'),
('c003','p002','u001','travel_kim',  'https://ui-avatars.com/api/?name=TK&background=4f46e5&color=fff','비르아켐 다리 꼭 가봐야겠네요! 정보 감사해요','2026-03-03T16:00:00'),
('c004','p004','u006','cafe_yoon',   'https://ui-avatars.com/api/?name=CY&background=ec4899&color=fff','골든가이는 혼자 가기 어색하지 않나요?','2026-03-07T20:00:00'),
('c005','p005','u003','asia_lee',    'https://ui-avatars.com/api/?name=AL&background=f59e0b&color=fff','사진 진짜 예쁘게 찍으셨네요. 어떤 카메라 쓰세요?','2026-03-08T13:00:00'),
('c006','p007','u009','backpack_lim','https://ui-avatars.com/api/?name=BL&background=0ea5e9&color=fff','융프라우 날씨가 맑았군요! 언제 가셨어요?','2026-03-12T09:00:00'),
('c007','p009','u005','photo_jung',  'https://ui-avatars.com/api/?name=PJ&background=8b5cf6&color=fff','바라나시 혼자 여행 안전한가요?','2026-03-15T07:00:00'),
('c008','p012','u001','travel_kim',  'https://ui-avatars.com/api/?name=TK&background=4f46e5&color=fff','발리 라이스테라스 버킷리스트인데 좋은 정보 감사해요!','2026-03-22T10:00:00');

-- ── 공지사항 ──
INSERT OR IGNORE INTO notices (id, title, content, type, active, created_at) VALUES
('n001','Travellog에 오신 것을 환영해요! 🎉','여행 이야기를 자유롭게 공유하고 친구들과 함께 일정을 계획해보세요.','info',1,'2026-01-01T00:00:00'),
('n002','새 기능: 일정 협업 & 채팅 출시 ✈','여행 플래너에서 친구를 초대하고 실시간으로 채팅하며 일정을 계획하세요!','feature',1,'2026-03-01T00:00:00'),
('n003','새 기능: 정보공유 페이지 오픈 📍','친구들의 여행 일정과 방문 장소를 확인할 수 있어요.','feature',1,'2026-04-01T00:00:00');

-- ── 기본값 정리 ──
UPDATE plans SET share_type='private' WHERE share_type IS NULL;
UPDATE plans SET share_schedule=0 WHERE share_schedule IS NULL;
UPDATE plans SET share_places=0 WHERE share_places IS NULL;

SELECT '✅ DB 초기화 완료!' as result;
SELECT '유저: '||count(*)||'명' FROM users;
SELECT '게시물: '||count(*)||'개' FROM posts;
SELECT '이미지: '||count(*)||'개' FROM post_images;

-- ── 플랜 시드 (다른 유저들의 전체공개 일정) ──
INSERT OR IGNORE INTO plans (id, user_id, user_nickname, user_profile_image, title, start_date, end_date, created_at, share_type, share_schedule, share_places) VALUES
('pl001','u001','travel_kim','https://ui-avatars.com/api/?name=TK&background=4f46e5&color=fff','오사카 3박4일','2026-05-01','2026-05-04','2026-04-01T10:00:00','public',1,1),
('pl002','u002','euro_park','https://ui-avatars.com/api/?name=EP&background=10b981&color=fff','파리 & 런던 7일','2026-06-10','2026-06-17','2026-04-02T10:00:00','public',1,1),
('pl003','u003','asia_lee','https://ui-avatars.com/api/?name=AL&background=f59e0b&color=fff','방콕 치앙마이 5일','2026-05-20','2026-05-25','2026-04-03T10:00:00','friends',1,1),
('pl004','u004','foodie_choi','https://ui-avatars.com/api/?name=FC&background=ef4444&color=fff','도쿄 맛집 투어 4일','2026-07-01','2026-07-04','2026-04-04T10:00:00','public',1,1),
('pl005','u005','photo_jung','https://ui-avatars.com/api/?name=PJ&background=8b5cf6&color=fff','바르셀로나 사진 여행 6일','2026-08-05','2026-08-11','2026-04-05T10:00:00','public',0,1);

-- plan_items (장소)
INSERT OR IGNORE INTO plan_items (id, plan_id, place_name, lat, lng, address, category, date, memo) VALUES
('pi001','pl001','도톤보리',34.6687,135.5007,'오사카 도톤보리','attraction','2026-05-01','타코야키 필수!'),
('pi002','pl001','오사카 성',34.6873,135.5262,'오사카 중앙구','attraction','2026-05-02','아침 일찍 가세요'),
('pi003','pl001','난바',34.6659,135.5014,'오사카 난바','restaurant','2026-05-03','쇼핑 & 맛집'),
('pi004','pl002','에펠탑',48.8584,2.2945,'파리 7구','attraction','2026-06-10','야간 조명 추천'),
('pi005','pl002','루브르 박물관',48.8606,2.3376,'파리 1구','attraction','2026-06-11','예약 필수'),
('pi006','pl002','빅벤',51.5007,-0.1246,'런던 웨스트민스터','attraction','2026-06-14','런던 도착 후'),
('pi007','pl004','츠키지 시장',35.6654,139.7707,'도쿄 츠키지','restaurant','2026-07-01','아침 일찍'),
('pi008','pl004','신주쿠 골든가이',35.6938,139.7036,'신주쿠','attraction','2026-07-02','야간 추천'),
('pi009','pl005','사그라다 파밀리아',41.4036,2.1744,'바르셀로나','attraction','2026-08-05','티켓 사전예매 필수'),
('pi010','pl005','구엘 공원',41.4145,2.1527,'바르셀로나','attraction','2026-08-06','황금시간대 방문');


SELECT '✅ 플랜 시드 완료!' as result;
SELECT '플랜: '||count(*)||'개' FROM plans;
SELECT '플랜 아이템: '||count(*)||'개' FROM plan_items;
