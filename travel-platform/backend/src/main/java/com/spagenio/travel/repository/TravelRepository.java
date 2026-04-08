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
        String q = "SELECT p FROM Post p WHERE p.visibility = 'public'";
        if (keyword != null && !keyword.isBlank()) q += " AND (LOWER(p.title) LIKE LOWER(:kw) OR LOWER(p.content) LIKE LOWER(:kw))";
        if (country != null && !country.isBlank()) q += " AND LOWER(p.country) LIKE LOWER(:ct)";
        if (city != null && !city.isBlank()) q += " AND LOWER(p.city) LIKE LOWER(:ci)";
        q += " ORDER BY p.createdAt DESC";

        var query = em.createQuery(q, Post.class);
        if (keyword != null && !keyword.isBlank()) query.setParameter("kw", "%" + keyword + "%");
        if (country != null && !country.isBlank()) query.setParameter("ct", "%" + country + "%");
        if (city != null && !city.isBlank()) query.setParameter("ci", "%" + city + "%");
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
        // 팔로잉한 사람들의 공유 일정 조회
        User user = findUserById(userId).orElse(null);
        if (user == null || user.getFollowingIds().isEmpty()) return new ArrayList<>();
        List<String> blocked = user.getBlockedIds();
        List<String> followingIds = user.getFollowingIds().stream()
                .filter(id -> !blocked.contains(id))
                .collect(java.util.stream.Collectors.toList());
        if (followingIds.isEmpty()) return new ArrayList<>();
        return em.createQuery(
                "SELECT p FROM Plan p WHERE p.userId IN :ids AND p.shareType IN ('friends','public') ORDER BY p.createdAt DESC",
                Plan.class)
                .setParameter("ids", followingIds)
                .getResultList();
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
}
