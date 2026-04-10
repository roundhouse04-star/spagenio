package com.spagenio.travel.repository;

import com.spagenio.travel.model.*;
import java.time.format.DateTimeFormatter;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Repository
@Transactional
public class TravelRepository {

    @PersistenceContext
    private EntityManager em;

    private String now() { return LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME); }
    private String uuid() { return UUID.randomUUID().toString().replace("-", "").substring(0, 12); }

    // ── User ──────────────────────────────────────────────
    public List<User> findAllUsers() {
        return em.createQuery("SELECT u FROM User u", User.class).getResultList();
    }

    public Optional<User> findUserById(String id) {
        return Optional.ofNullable(em.find(User.class, id));
    }

    public Optional<User> findUserByNickname(String nickname) {
        List<User> result = em.createQuery("SELECT u FROM User u WHERE u.nickname = :n", User.class)
                .setParameter("n", nickname).getResultList();
        return result.isEmpty() ? Optional.empty() : Optional.of(result.get(0));
    }

    public Optional<User> findUserByEmail(String email) {
        List<User> result = em.createQuery("SELECT u FROM User u WHERE u.email = :e", User.class)
                .setParameter("e", email).getResultList();
        return result.isEmpty() ? Optional.empty() : Optional.of(result.get(0));
    }

    public User saveUser(User user) {
        if (user.getId() == null) {
            user.setId(uuid());
            user.setCreatedAt(now());
            em.persist(user);
        } else {
            user = em.merge(user);
        }
        return user;
    }

    public User followUser(String userId, String targetId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        User target = findUserById(targetId).orElseThrow(() -> new IllegalArgumentException("target_not_found"));
        if (!user.getFollowingIds().contains(targetId)) {
            user.getFollowingIds().add(targetId);
            target.getFollowerIds().add(userId);
            em.merge(user);
            em.merge(target);
        }
        return user;
    }

    public User unfollowUser(String userId, String targetId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        User target = findUserById(targetId).orElseThrow(() -> new IllegalArgumentException("target_not_found"));
        user.getFollowingIds().remove(targetId);
        target.getFollowerIds().remove(userId);
        em.merge(user);
        em.merge(target);
        return user;
    }

    public User blockUser(String userId, String targetId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        User target = findUserById(targetId).orElseThrow(() -> new IllegalArgumentException("target_not_found"));
        if (!user.getBlockedIds().contains(targetId)) {
            user.getBlockedIds().add(targetId);
            // 팔로우 관계도 제거
            user.getFollowingIds().remove(targetId);
            target.getFollowerIds().remove(userId);
            target.getFollowingIds().remove(userId);
            user.getFollowerIds().remove(targetId);
            em.merge(user);
            em.merge(target);
        }
        return user;
    }

    public User unblockUser(String userId, String targetId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        user.getBlockedIds().remove(targetId);
        return em.merge(user);
    }

    public List<User> findFollowers(String userId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        if (user.getFollowerIds().isEmpty()) return new ArrayList<>();
        return em.createQuery("SELECT u FROM User u WHERE u.id IN :ids", User.class)
                .setParameter("ids", user.getFollowerIds()).getResultList();
    }

    public List<User> findFollowings(String userId) {
        User user = findUserById(userId).orElseThrow(() -> new IllegalArgumentException("user_not_found"));
        if (user.getFollowingIds().isEmpty()) return new ArrayList<>();
        return em.createQuery("SELECT u FROM User u WHERE u.id IN :ids", User.class)
                .setParameter("ids", user.getFollowingIds()).getResultList();
    }

    // ── Post ──────────────────────────────────────────────
    public List<Post> findAllPosts(String currentUserId) {
        User current = currentUserId != null ? findUserById(currentUserId).orElse(null) : null;
        List<String> blocked = current != null ? current.getBlockedIds() : new ArrayList<>();
        if (blocked.isEmpty()) {
            return em.createQuery("SELECT p FROM Post p WHERE p.visibility = 'public' OR p.userId = :uid ORDER BY p.createdAt DESC", Post.class)
                    .setParameter("uid", currentUserId != null ? currentUserId : "").getResultList();
        }
        return em.createQuery("SELECT p FROM Post p WHERE (p.visibility = 'public' OR p.userId = :uid) AND p.userId NOT IN :blocked ORDER BY p.createdAt DESC", Post.class)
                .setParameter("uid", currentUserId != null ? currentUserId : "")
                .setParameter("blocked", blocked).getResultList();
    }

    public List<Post> findAllPosts() { return findAllPosts(null); }

    public List<Post> findFeedPosts(String userId) {
        User user = findUserById(userId).orElse(null);
        if (user == null || user.getFollowingIds().isEmpty()) return findAllPosts(userId);
        List<String> blocked = user.getBlockedIds();
        List<String> followingIds = new ArrayList<>(user.getFollowingIds());
        followingIds.add(userId); // 내 글도 포함
        if (blocked.isEmpty()) {
            return em.createQuery("SELECT p FROM Post p WHERE p.userId IN :ids AND (p.visibility = 'public' OR p.userId = :uid) ORDER BY p.createdAt DESC", Post.class)
                    .setParameter("ids", followingIds).setParameter("uid", userId).getResultList();
        }
        followingIds.removeAll(blocked);
        if (followingIds.isEmpty()) return new ArrayList<>();
        return em.createQuery("SELECT p FROM Post p WHERE p.userId IN :ids AND (p.visibility = 'public' OR p.userId = :uid) ORDER BY p.createdAt DESC", Post.class)
                .setParameter("ids", followingIds).setParameter("uid", userId).getResultList();
    }

    public List<Post> findPostsByUserId(String userId) {
        return em.createQuery("SELECT p FROM Post p WHERE p.userId = :id ORDER BY p.createdAt DESC", Post.class)
                .setParameter("id", userId).getResultList();
    }

    public List<Post> searchPosts(String keyword, String country, String city) {
        return searchPosts(keyword, country, city, null);
    }

    public List<Post> searchPosts(String keyword, String country, String city, String travelStyle) {
        String q = "SELECT p FROM Post p WHERE p.visibility = 'public'";
        if (keyword != null && !keyword.isBlank()) q += " AND (LOWER(p.title) LIKE LOWER(:kw) OR LOWER(p.content) LIKE LOWER(:kw))";
        if (country != null && !country.isBlank()) q += " AND LOWER(p.country) LIKE LOWER(:ct)";
        if (city != null && !city.isBlank()) q += " AND LOWER(p.city) LIKE LOWER(:ci)";
        if (travelStyle != null && !travelStyle.isBlank()) q += " AND :ts MEMBER OF p.travelStyles";
        q += " ORDER BY p.createdAt DESC";

        var query = em.createQuery(q, Post.class);
        if (keyword != null && !keyword.isBlank()) query.setParameter("kw", "%" + keyword + "%");
        if (country != null && !country.isBlank()) query.setParameter("ct", "%" + country + "%");
        if (city != null && !city.isBlank()) query.setParameter("ci", "%" + city + "%");
        if (travelStyle != null && !travelStyle.isBlank()) query.setParameter("ts", travelStyle);
        return query.getResultList();
    }

    public Optional<Post> findPostById(String id) {
        return Optional.ofNullable(em.find(Post.class, id));
    }

    public Post savePost(Post post) {
        if (post.getId() == null) {
            post.setId(uuid());
            post.setCreatedAt(now());
            if (post.getPlaces() != null) {
                final String postId = post.getId();
                post.getPlaces().forEach(pl -> { if (pl.getId() == null) pl.setId(uuid()); pl.setPostId(postId); });
            }
            em.persist(post);
        } else {
            post = em.merge(post);
        }
        return post;
    }

    public Post toggleLike(String postId, String userId) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        if (post.getLikedUserIds().contains(userId)) post.getLikedUserIds().remove(userId);
        else post.getLikedUserIds().add(userId);
        return em.merge(post);
    }

    public Post addComment(String postId, Comment comment) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        comment.setId(uuid());
        comment.setPostId(postId);
        comment.setCreatedAt(now());
        post.getComments().add(comment);
        return em.merge(post);
    }

    public Post deleteComment(String postId, String commentId) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        post.getComments().removeIf(c -> c.getId().equals(commentId));
        return em.merge(post);
    }

    public Post updatePost(String postId, String title, String content) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        if (title != null && !title.isBlank()) post.setTitle(title);
        if (content != null) post.setContent(content);
        return em.merge(post);
    }

    public void deletePost(String postId) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        em.remove(post);
    }

    // ── Plan ──────────────────────────────────────────────
    public List<Plan> findPlansByUserId(String userId) {
        return em.createQuery("SELECT p FROM Plan p WHERE p.userId = :id ORDER BY p.createdAt DESC", Plan.class)
                .setParameter("id", userId).getResultList();
    }

    public Optional<Plan> findPlanById(String id) {
        return Optional.ofNullable(em.find(Plan.class, id));
    }

    public Plan savePlan(Plan plan) {
        if (plan.getId() == null) {
            plan.setId(uuid());
            plan.setCreatedAt(now());
            em.persist(plan);
        } else {
            plan = em.merge(plan);
        }
        return plan;
    }

    public Plan addPlanItem(String planId, PlanItem item) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        item.setId(uuid());
        item.setPlanId(planId);
        plan.getItems().add(item);
        return em.merge(plan);
    }

    public Plan removePlanItem(String planId, String itemId) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        plan.getItems().removeIf(i -> i.getId().equals(itemId));
        return em.merge(plan);
    }

    public List<Plan> findSharedPlansByFriends(String userId) {
        User user = findUserById(userId).orElse(null);
        List<String> blocked = user != null ? user.getBlockedIds() : new ArrayList<>();

        // 1) 전체공개(public) 일정 — 본인 제외, 차단 제외
        List<Plan> publicPlans = em.createQuery(
                "SELECT p FROM Plan p WHERE p.shareType = 'public' AND p.userId != :uid ORDER BY p.createdAt DESC",
                Plan.class)
                .setParameter("uid", userId)
                .getResultList()
                .stream()
                .filter(p -> !blocked.contains(p.getUserId()))
                .collect(java.util.stream.Collectors.toList());

        // 2) 친구공개(friends) 일정 — 팔로잉한 친구만
        List<Plan> friendPlans = new ArrayList<>();
        if (user != null && !user.getFollowingIds().isEmpty()) {
            List<String> followingIds = user.getFollowingIds().stream()
                    .filter(id -> !blocked.contains(id))
                    .collect(java.util.stream.Collectors.toList());
            if (!followingIds.isEmpty()) {
                friendPlans = em.createQuery(
                        "SELECT p FROM Plan p WHERE p.userId IN :ids AND p.shareType = 'friends' ORDER BY p.createdAt DESC",
                        Plan.class)
                        .setParameter("ids", followingIds)
                        .getResultList();
            }
        }

        // 합치기 (중복 제거)
        java.util.Map<String, Plan> merged = new java.util.LinkedHashMap<>();
        for (Plan p : publicPlans) merged.put(p.getId(), p);
        for (Plan p : friendPlans) merged.put(p.getId(), p);
        return new ArrayList<>(merged.values());
    }

    public void deletePlan(String planId) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        em.remove(plan);
    }

    // ── Report ────────────────────────────────────────────
    public List<Report> findAllReports() {
        return em.createQuery("SELECT r FROM Report r ORDER BY r.createdAt DESC", Report.class).getResultList();
    }

    public List<Report> findPendingReports() {
        return em.createQuery("SELECT r FROM Report r WHERE r.status = 'pending' ORDER BY r.createdAt DESC", Report.class).getResultList();
    }

    public Report saveReport(Report report) {
        if (report.getId() == null) {
            report.setId(uuid());
            report.setCreatedAt(now());
            report.setStatus("pending");
            em.persist(report);
        } else {
            report = em.merge(report);
        }
        return report;
    }

    public Optional<Report> findReportById(String id) {
        return Optional.ofNullable(em.find(Report.class, id));
    }

    public Report resolveReport(String id, String action) {
        Report report = findReportById(id).orElseThrow(() -> new IllegalArgumentException("report_not_found"));
        report.setStatus(action); // resolved | dismissed
        report.setResolvedAt(now());
        return em.merge(report);
    }

    // ── Notice ────────────────────────────────────────────
    public List<Notice> findAllNotices() {
        return em.createQuery("SELECT n FROM Notice n ORDER BY n.createdAt DESC", Notice.class).getResultList();
    }

    public List<Notice> findActiveNotices() {
        return em.createQuery("SELECT n FROM Notice n WHERE n.active = true ORDER BY n.createdAt DESC", Notice.class).getResultList();
    }

    public Optional<Notice> findNoticeById(String id) {
        return Optional.ofNullable(em.find(Notice.class, id));
    }

    public Notice saveNotice(Notice notice) {
        if (notice.getId() == null) {
            notice.setId(uuid());
            notice.setCreatedAt(now());
            notice.setUpdatedAt(now());
            em.persist(notice);
        } else {
            notice.setUpdatedAt(now());
            notice = em.merge(notice);
        }
        return notice;
    }

    public void deleteNotice(String id) {
        Notice notice = findNoticeById(id).orElseThrow(() -> new IllegalArgumentException("notice_not_found"));
        em.remove(notice);
    }

    // ── Plan Members & Messages ───────────────────────────
    public Plan inviteMember(String planId, User invitee) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        boolean exists = plan.getMembers().stream().anyMatch(m -> m.getUserId().equals(invitee.getId()));
        if (!exists) {
            PlanMember member = new PlanMember();
            member.setId(uuid());
            member.setPlanId(planId);
            member.setUserId(invitee.getId());
            member.setUserNickname(invitee.getNickname());
            member.setUserProfileImage(invitee.getProfileImage());
            member.setRole("member");
            member.setJoinedAt(now());
            plan.getMembers().add(member);
            em.merge(plan);
        }
        return plan;
    }

    public Plan removeMember(String planId, String userId) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        plan.getMembers().removeIf(m -> m.getUserId().equals(userId));
        return em.merge(plan);
    }

    public List<PlanMessage> findMessages(String planId) {
        return em.createQuery("SELECT m FROM PlanMessage m WHERE m.planId = :id ORDER BY m.createdAt ASC", PlanMessage.class)
                .setParameter("id", planId).getResultList();
    }

    public PlanMessage saveMessage(PlanMessage msg) {
        msg.setId(uuid());
        msg.setCreatedAt(now());
        em.persist(msg);
        return msg;
    }

    public List<Plan> findPlansByMember(String userId) {
        // 내가 멤버로 초대된 일정
        return em.createQuery(
            "SELECT p FROM Plan p JOIN p.members m WHERE m.userId = :uid ORDER BY p.createdAt DESC", Plan.class)
                .setParameter("uid", userId).getResultList();
    }

    // ── Admin Stats ───────────────────────────────────────
    public Map<String, Object> getAdminStats() {
        long totalPosts = (long) em.createQuery("SELECT COUNT(p) FROM Post p").getSingleResult();
        long publicPosts = (long) em.createQuery("SELECT COUNT(p) FROM Post p WHERE p.visibility = 'public'").getSingleResult();
        long pendingReports = (long) em.createQuery("SELECT COUNT(r) FROM Report r WHERE r.status = 'pending'").getSingleResult();
        long totalLikes = em.createQuery("SELECT p FROM Post p", Post.class).getResultList()
                .stream().mapToLong(p -> p.getLikedUserIds().size()).sum();

        // 국가별 게시물
        List<Object[]> countryStats = em.createQuery(
                "SELECT p.country, COUNT(p) FROM Post p WHERE p.country IS NOT NULL AND p.country != '' GROUP BY p.country ORDER BY COUNT(p) DESC",
                Object[].class).setMaxResults(10).getResultList();

        // 인기 태그
        List<Post> allPosts = em.createQuery("SELECT p FROM Post p", Post.class).getResultList();
        Map<String, Long> tagCount = new java.util.HashMap<>();
        allPosts.forEach(p -> p.getTags().forEach(t -> tagCount.merge(t, 1L, Long::sum)));
        List<Map<String, Object>> topTags = tagCount.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(10)
                .map(e -> Map.<String, Object>of("tag", e.getKey(), "count", e.getValue()))
                .collect(java.util.stream.Collectors.toList());

        // 인기 게시물
        List<Post> topPosts = em.createQuery("SELECT p FROM Post p WHERE p.visibility = 'public' ORDER BY SIZE(p.likedUserIds) DESC", Post.class)
                .setMaxResults(10).getResultList();

        return Map.of(
            "totalPosts", totalPosts,
            "publicPosts", publicPosts,
            "pendingReports", pendingReports,
            "totalLikes", totalLikes,
            "countryStats", countryStats,
            "topTags", topTags,
            "topPosts", topPosts
        );
    }

    // ── Promotion ─────────────────────────────────────────

    // ── 위치 기반 장소 검색 ───────────────────────────────
    // 반경 내 장소가 포함된 게시물 검색 (하버사인 공식 근사)
    public List<Post> findPostsNearby(double lat, double lng, double radiusKm) {
        // lat/lng 범위로 1차 필터링 (1도 ≈ 111km)
        double latDelta = radiusKm / 111.0;
        double lngDelta = radiusKm / (111.0 * Math.cos(Math.toRadians(lat)));

        List<Post> candidates = em.createQuery(
            "SELECT DISTINCT p FROM Post p JOIN p.places pl " +
            "WHERE p.visibility = 'public' " +
            "AND pl.lat BETWEEN :minLat AND :maxLat " +
            "AND pl.lng BETWEEN :minLng AND :maxLng " +
            "ORDER BY p.createdAt DESC", Post.class)
            .setParameter("minLat", lat - latDelta)
            .setParameter("maxLat", lat + latDelta)
            .setParameter("minLng", lng - lngDelta)
            .setParameter("maxLng", lng + lngDelta)
            .setMaxResults(50)
            .getResultList();

        // 하버사인 공식으로 정확한 거리 계산하여 필터링
        return candidates.stream().filter(post ->
            post.getPlaces().stream().anyMatch(place -> {
                double dLat = Math.toRadians(place.getLat() - lat);
                double dLng = Math.toRadians(place.getLng() - lng);
                double a = Math.sin(dLat/2) * Math.sin(dLat/2)
                    + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(place.getLat()))
                    * Math.sin(dLng/2) * Math.sin(dLng/2);
                double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return 6371 * c <= radiusKm;
            })
        ).collect(java.util.stream.Collectors.toList());
    }

    // 유저가 저장한 장소 중 근처 있는 것 찾기
    public List<Map<String, Object>> findSavedPlacesNearby(String userId, double lat, double lng, double radiusKm) {
        double latDelta = radiusKm / 111.0;
        double lngDelta = radiusKm / (111.0 * Math.cos(Math.toRadians(lat)));

        User user = em.find(User.class, userId);
        if (user == null || user.getSavedPostIds().isEmpty()) return new java.util.ArrayList<>();

        List<Post> savedPosts = em.createQuery(
            "SELECT p FROM Post p WHERE p.id IN :ids", Post.class)
            .setParameter("ids", user.getSavedPostIds())
            .getResultList();

        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Post post : savedPosts) {
            for (var place : post.getPlaces()) {
                if (place.getLat() == 0 && place.getLng() == 0) continue;
                double dLat = Math.toRadians(place.getLat() - lat);
                double dLng = Math.toRadians(place.getLng() - lng);
                double a = Math.sin(dLat/2) * Math.sin(dLat/2)
                    + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(place.getLat()))
                    * Math.sin(dLng/2) * Math.sin(dLng/2);
                double distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                if (distKm <= radiusKm) {
                    result.add(Map.of(
                        "postId", post.getId(),
                        "postTitle", post.getTitle(),
                        "placeName", place.getName(),
                        "address", place.getAddress() != null ? place.getAddress() : "",
                        "lat", place.getLat(),
                        "lng", place.getLng(),
                        "distKm", Math.round(distKm * 10.0) / 10.0,
                        "userNickname", post.getUserNickname(),
                        "image", post.getImages() != null && !post.getImages().isEmpty() ? post.getImages().get(0) : ""
                    ));
                }
            }
        }
        result.sort((a2, b2) -> Double.compare((Double)a2.get("distKm"), (Double)b2.get("distKm")));
        return result;
    }
    public List<Promotion> findActivePromotions() {
        return em.createQuery("SELECT p FROM Promotion p WHERE p.active = true ORDER BY p.priority DESC, p.createdAt DESC", Promotion.class).getResultList();
    }

    public List<Promotion> findAllPromotions() {
        return em.createQuery("SELECT p FROM Promotion p ORDER BY p.createdAt DESC", Promotion.class).getResultList();
    }

    public Promotion savePromotion(Promotion p) {
        if (p.getId() == null) { p.setId(uuid()); p.setCreatedAt(now()); em.persist(p); }
        else p = em.merge(p);
        return p;
    }

    public void deletePromotion(String id) {
        Promotion p = em.find(Promotion.class, id);
        if (p != null) em.remove(p);
    }

    // ── Menu Items ────────────────────────────────────────
    // 기본 메뉴 목록
    private static final Object[][] DEFAULT_MENUS = {
        {"feed",     "🏠", "홈",       true,  0,  false},
        {"nearby",   "📍", "내 주변",   true,  1,  true},
        {"explore",  "🔍", "탐색",     true,  2,  false},
        {"write",    "✏️", "글쓰기",   true,  3,  true},
        {"planner",  "🗺️", "일정",     true,  4,  true},
        {"share",    "🔗", "정보공유", true,  5,  true},
        {"exchange", "💱", "환율",     true,  6,  false},
        {"profile",  "👤", "프로필",   true,  7,  true},
    };

    public List<MenuItem> findAllMenuItems() {
        List<MenuItem> items = em.createQuery("SELECT m FROM MenuItem m ORDER BY m.sortOrder", MenuItem.class).getResultList();
        // DB가 비어있으면 기본값으로 초기화
        if (items.isEmpty()) {
            for (Object[] d : DEFAULT_MENUS) {
                MenuItem m = new MenuItem();
                m.setKey((String) d[0]);
                m.setIcon((String) d[1]);
                m.setLabel((String) d[2]);
                m.setVisible((boolean) d[3]);
                m.setSortOrder((int) d[4]);
                m.setRequireLogin((boolean) d[5]);
                em.persist(m);
            }
            items = em.createQuery("SELECT m FROM MenuItem m ORDER BY m.sortOrder", MenuItem.class).getResultList();
        }
        return items;
    }

    public MenuItem saveMenuItem(MenuItem m) {
        MenuItem existing = em.find(MenuItem.class, m.getKey());
        if (existing == null) em.persist(m);
        else {
            existing.setIcon(m.getIcon());
            existing.setLabel(m.getLabel());
            existing.setVisible(m.isVisible());
            existing.setSortOrder(m.getSortOrder());
            existing.setRequireLogin(m.isRequireLogin());
        }
        return m;
    }

    public void saveAllMenuItems(List<MenuItem> items) {
        for (MenuItem m : items) saveMenuItem(m);
    }
}
