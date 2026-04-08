package com.spagenio.travel.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spagenio.travel.model.*;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Repository
public class TravelRepository {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path storagePath = Paths.get("data", "travel-sns-db.json");
    private TravelDatabase database;

    @PostConstruct
    public synchronized void init() {
        try {
            Files.createDirectories(storagePath.getParent());
            if (Files.exists(storagePath)) {
                database = objectMapper.readValue(storagePath.toFile(), TravelDatabase.class);
            } else {
                database = createSeedDatabase();
                persist();
            }
        } catch (IOException e) {
            throw new RuntimeException("DB init failed", e);
        }
    }

    private synchronized void persist() {
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(storagePath.toFile(), database);
        } catch (IOException e) {
            throw new RuntimeException("DB persist failed", e);
        }
    }

    private String now() {
        return LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }

    private String uuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    // ── User ────────────────────────────────────────────────
    public synchronized List<User> findAllUsers() { return database.getUsers(); }

    public synchronized Optional<User> findUserById(String id) {
        return database.getUsers().stream().filter(u -> u.getId().equals(id)).findFirst();
    }

    public synchronized Optional<User> findUserByNickname(String nickname) {
        return database.getUsers().stream().filter(u -> u.getNickname().equals(nickname)).findFirst();
    }

    public synchronized User saveUser(User user) {
        if (user.getId() == null) {
            user.setId(uuid());
            user.setCreatedAt(now());
            database.getUsers().add(user);
        } else {
            database.getUsers().replaceAll(u -> u.getId().equals(user.getId()) ? user : u);
        }
        persist();
        return user;
    }

    public synchronized User followUser(String userId, String targetId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        User target = findUserById(targetId).orElseThrow(() -> new IllegalArgumentException("target_not_found"));
        if (!user.getFollowingIds().contains(targetId)) {
            user.getFollowingIds().add(targetId);
            target.getFollowerIds().add(userId);
        }
        persist();
        return target;
    }

    public synchronized User unfollowUser(String userId, String targetId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        User target = findUserById(targetId).orElseThrow(() -> new IllegalArgumentException("target_not_found"));
        user.getFollowingIds().remove(targetId);
        target.getFollowerIds().remove(userId);
        persist();
        return target;
    }

    // ── Post ────────────────────────────────────────────────
    public synchronized List<Post> findAllPosts() {
        return database.getPosts().stream()
                .sorted(Comparator.comparing(Post::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public synchronized List<Post> findPostsByUserId(String userId) {
        return database.getPosts().stream()
                .filter(p -> p.getUserId().equals(userId))
                .sorted(Comparator.comparing(Post::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public synchronized List<Post> findFeedPosts(String userId) {
        User user = findUserById(userId).orElse(null);
        Set<String> following = user != null ? new HashSet<>(user.getFollowingIds()) : new HashSet<>();
        following.add(userId);
        return database.getPosts().stream()
                .filter(p -> following.contains(p.getUserId()))
                .sorted(Comparator.comparing(Post::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public synchronized List<Post> searchPosts(String keyword, String country, String city) {
        return database.getPosts().stream()
                .filter(p -> keyword == null || keyword.isBlank() ||
                        p.getTitle().toLowerCase().contains(keyword.toLowerCase()) ||
                        p.getContent().toLowerCase().contains(keyword.toLowerCase()) ||
                        p.getTags().stream().anyMatch(t -> t.toLowerCase().contains(keyword.toLowerCase())))
                .filter(p -> country == null || country.isBlank() || country.equalsIgnoreCase(p.getCountry()))
                .filter(p -> city == null || city.isBlank() || city.equalsIgnoreCase(p.getCity()))
                .sorted(Comparator.comparing(Post::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public synchronized Optional<Post> findPostById(String id) {
        return database.getPosts().stream().filter(p -> p.getId().equals(id)).findFirst();
    }

    public synchronized Post savePost(Post post) {
        post.setId(uuid());
        post.setCreatedAt(now());
        database.getPosts().add(0, post);
        persist();
        return post;
    }

    public synchronized Post toggleLike(String postId, String userId) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        if (post.getLikedUserIds().contains(userId)) {
            post.getLikedUserIds().remove(userId);
        } else {
            post.getLikedUserIds().add(userId);
        }
        persist();
        return post;
    }

    public synchronized Post addComment(String postId, Comment comment) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        comment.setId(uuid());
        comment.setCreatedAt(now());
        post.getComments().add(comment);
        persist();
        return post;
    }

    public synchronized void deletePost(String postId) {
        database.getPosts().removeIf(p -> p.getId().equals(postId));
        persist();
    }

    // ── Plan ────────────────────────────────────────────────
    public synchronized List<Plan> findPlansByUserId(String userId) {
        return database.getPlans().stream()
                .filter(p -> p.getUserId().equals(userId))
                .sorted(Comparator.comparing(Plan::getUpdatedAt).reversed())
                .collect(Collectors.toList());
    }

    public synchronized Optional<Plan> findPlanById(String id) {
        return database.getPlans().stream().filter(p -> p.getId().equals(id)).findFirst();
    }

    public synchronized Plan savePlan(Plan plan) {
        if (plan.getId() == null) {
            plan.setId(uuid());
            plan.setCreatedAt(now());
            plan.setUpdatedAt(now());
            database.getPlans().add(plan);
        } else {
            plan.setUpdatedAt(now());
            database.getPlans().replaceAll(p -> p.getId().equals(plan.getId()) ? plan : p);
        }
        persist();
        return plan;
    }

    public synchronized Plan addPlanItem(String planId, PlanItem item) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        item.setId(uuid());
        plan.getItems().add(item);
        plan.setUpdatedAt(now());
        persist();
        return plan;
    }

    public synchronized Plan removePlanItem(String planId, String itemId) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        plan.getItems().removeIf(i -> i.getId().equals(itemId));
        plan.setUpdatedAt(now());
        persist();
        return plan;
    }

    public synchronized void deletePlan(String planId) {
        database.getPlans().removeIf(p -> p.getId().equals(planId));
        persist();
    }

    // ── Seed ────────────────────────────────────────────────
    private TravelDatabase createSeedDatabase() {
        TravelDatabase db = new TravelDatabase();

        User u1 = new User();
        u1.setId("user001"); u1.setNickname("여행하는김씨"); u1.setBio("세계 50개국 여행 중 🌍");
        u1.setProfileImage("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face");
        u1.setVisitedCountries(23); u1.setCreatedAt(now());
        u1.setFollowerIds(new ArrayList<>(List.of("user002", "user003")));
        u1.setFollowingIds(new ArrayList<>(List.of("user002")));

        User u2 = new User();
        u2.setId("user002"); u2.setNickname("오사카러버"); u2.setBio("일본 전문 여행러 🇯🇵");
        u2.setProfileImage("https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face");
        u2.setVisitedCountries(8); u2.setCreatedAt(now());
        u2.setFollowerIds(new ArrayList<>(List.of("user001")));
        u2.setFollowingIds(new ArrayList<>(List.of("user001", "user003")));

        User u3 = new User();
        u3.setId("user003"); u3.setNickname("발리드리머"); u3.setBio("리조트 & 자연 여행 좋아요 🌴");
        u3.setProfileImage("https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face");
        u3.setVisitedCountries(15); u3.setCreatedAt(now());
        u3.setFollowerIds(new ArrayList<>(List.of("user001", "user002")));
        u3.setFollowingIds(new ArrayList<>(List.of("user001")));

        db.setUsers(new ArrayList<>(List.of(u1, u2, u3)));

        // 오사카 게시물
        Post p1 = new Post();
        p1.setId("post001"); p1.setUserId("user001"); p1.setUserNickname("여행하는김씨");
        p1.setUserProfileImage(u1.getProfileImage());
        p1.setTitle("오사카 3박4일 완전 정복 코스 🍜"); p1.setCountry("일본"); p1.setCity("오사카");
        p1.setContent("오사카 처음 가시는 분들 필독! 도톤보리부터 유니버설까지 알짜 코스만 모았어요. 특히 구로몬 시장 꼭 가세요 — 아침 일찍 가면 신선한 해산물을 저렴하게 먹을 수 있어요.");
        p1.setImages(List.of(
            "https://images.unsplash.com/photo-1548872591-bd39a8f93e36?w=800&fit=crop",
            "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&fit=crop",
            "https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?w=800&fit=crop"
        ));
        p1.setTags(List.of("오사카", "일본여행", "먹방여행", "도톤보리"));
        p1.setLikedUserIds(new ArrayList<>(List.of("user002", "user003")));

        Place pl1 = new Place(); pl1.setOrder(1); pl1.setName("도톤보리"); pl1.setAddress("오사카부 츄오구 도톤보리");
        pl1.setLat(34.6687); pl1.setLng(135.5003); pl1.setCategory("관광");
        pl1.setHowToGet("난바역 14번 출구에서 도보 3분"); pl1.setTip("저녁 7시 이후 야경이 특히 예쁨");

        Place pl2 = new Place(); pl2.setOrder(2); pl2.setName("구로몬 시장"); pl2.setAddress("오사카부 츄오구 닛폰바시");
        pl2.setLat(34.6656); pl2.setLng(135.5065); pl2.setCategory("맛집");
        pl2.setHowToGet("닛폰바시역 5번 출구에서 도보 2분"); pl2.setTip("오전 9시~11시 사이 방문 추천, 점심엔 붐빔");

        Place pl3 = new Place(); pl3.setOrder(3); pl3.setName("오사카성"); pl3.setAddress("오사카부 츄오구 오사카조");
        pl3.setLat(34.6873); pl3.setLng(135.5259); pl3.setCategory("역사");
        pl3.setHowToGet("모리노미야역 1번 출구에서 도보 10분"); pl3.setTip("천수각 입장료 600엔, 주변 공원 산책 무료");

        p1.setPlaces(List.of(pl1, pl2, pl3));
        p1.setCreatedAt(LocalDateTime.now().minusDays(3).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        Comment c1 = new Comment(); c1.setId("cmt001"); c1.setUserId("user002");
        c1.setUserNickname("오사카러버"); c1.setUserProfileImage(u2.getProfileImage());
        c1.setContent("구로몬 시장 강추예요! 저도 갔다왔는데 정말 좋았어요 🎉"); c1.setCreatedAt(now());
        p1.setComments(new ArrayList<>(List.of(c1)));

        // 발리 게시물
        Post p2 = new Post();
        p2.setId("post002"); p2.setUserId("user003"); p2.setUserNickname("발리드리머");
        p2.setUserProfileImage(u3.getProfileImage());
        p2.setTitle("발리 우붓 힐링 여행 🌿"); p2.setCountry("인도네시아"); p2.setCity("발리");
        p2.setContent("발리 남부 꾼따 해변보다 우붓이 훨씬 좋았어요. 논밭 사이 걷기, 전통 사원, 그리고 가성비 최고의 마사지까지. 하루 5만원으로 풍요롭게 지낼 수 있는 곳!");
        p2.setImages(List.of(
            "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&fit=crop",
            "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&fit=crop"
        ));
        p2.setTags(List.of("발리", "우붓", "힐링여행", "인도네시아"));
        p2.setLikedUserIds(new ArrayList<>(List.of("user001")));

        Place pl4 = new Place(); pl4.setOrder(1); pl4.setName("우붓 왕궁"); pl4.setAddress("Jl. Raya Ubud, Ubud, Bali");
        pl4.setLat(-8.5069); pl4.setLng(115.2625); pl4.setCategory("문화");
        pl4.setHowToGet("우붓 중심가에서 도보 5분"); pl4.setTip("저녁 케착 댄스 공연 강추 (7만루피아)");

        Place pl5 = new Place(); pl5.setOrder(2); pl5.setName("떼갈랄랑 라이스 테라스"); pl5.setAddress("Tegallalang, Gianyar Regency, Bali");
        pl5.setLat(-8.4313); pl5.setLng(115.2779); pl5.setCategory("자연");
        pl5.setHowToGet("우붓에서 차로 20분, 그랩 편도 5만루피아 정도"); pl5.setTip("오전 8시 이전 방문하면 사람 없이 사진 찍기 좋음");

        p2.setPlaces(List.of(pl4, pl5));
        p2.setComments(new ArrayList<>());
        p2.setCreatedAt(LocalDateTime.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        // 도쿄 게시물
        Post p3 = new Post();
        p3.setId("post003"); p3.setUserId("user002"); p3.setUserNickname("오사카러버");
        p3.setUserProfileImage(u2.getProfileImage());
        p3.setTitle("도쿄 시부야 & 하라주쿠 2일 코스 🗼"); p3.setCountry("일본"); p3.setCity("도쿄");
        p3.setContent("도쿄 패션과 팝컬처의 심장, 시부야와 하라주쿠를 하루씩 제대로 즐기는 방법! 타케시타 도리에서 크레페 먹고 메이지 신궁에서 힐링하는 루트 공유해요.");
        p3.setImages(List.of(
            "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&fit=crop",
            "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&fit=crop"
        ));
        p3.setTags(List.of("도쿄", "시부야", "하라주쿠", "일본여행"));
        p3.setLikedUserIds(new ArrayList<>(List.of("user001", "user003")));

        Place pl6 = new Place(); pl6.setOrder(1); pl6.setName("시부야 스크램블 교차로"); pl6.setAddress("Shibuya, Tokyo");
        pl6.setLat(35.6595); pl6.setLng(139.7004); pl6.setCategory("관광");
        pl6.setHowToGet("시부야역 하치코 출구 바로 앞"); pl6.setTip("스타벅스 2층에서 내려다보는 뷰 추천");

        Place pl7 = new Place(); pl7.setOrder(2); pl7.setName("메이지 신궁"); pl7.setAddress("1-1 Yoyogikamizonocho, Shibuya City, Tokyo");
        pl7.setLat(35.6763); pl7.setLng(139.6993); pl7.setCategory("역사");
        pl7.setHowToGet("하라주쿠역에서 도보 3분"); pl7.setTip("입장 무료, 오전 일찍 가면 조용하고 좋음");

        p3.setPlaces(List.of(pl6, pl7));
        p3.setComments(new ArrayList<>());
        p3.setCreatedAt(LocalDateTime.now().minusHours(6).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        db.setPosts(new ArrayList<>(List.of(p3, p1, p2)));

        // 샘플 플랜
        Plan plan1 = new Plan();
        plan1.setId("plan001"); plan1.setUserId("user001");
        plan1.setTitle("오사카 여행 계획"); plan1.setStartDate("2026-05-01"); plan1.setEndDate("2026-05-04");
        plan1.setCreatedAt(now()); plan1.setUpdatedAt(now());

        PlanItem pi1 = new PlanItem(); pi1.setId("pi001");
        pi1.setPlaceName("도톤보리"); pi1.setLat(34.6687); pi1.setLng(135.5003);
        pi1.setAddress("오사카부 츄오구 도톤보리"); pi1.setCategory("관광");
        pi1.setHowToGet("난바역 14번 출구에서 도보 3분"); pi1.setTip("저녁 7시 이후 야경이 특히 예쁨");
        pi1.setFromPostId("post001"); pi1.setFromPostTitle("오사카 3박4일 완전 정복 코스 🍜");
        pi1.setFromUserNickname("여행하는김씨"); pi1.setDate("2026-05-01"); pi1.setMemo("저녁 일정");

        plan1.setItems(new ArrayList<>(List.of(pi1)));
        db.setPlans(new ArrayList<>(List.of(plan1)));

        return db;
    }
}
