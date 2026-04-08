package com.spagenio.travel.repository;

import com.spagenio.travel.model.*;
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

    private String now() {
        return LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }

    private String uuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

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

    // ── Post ──────────────────────────────────────────────
    public List<Post> findAllPosts() {
        return em.createQuery("SELECT p FROM Post p ORDER BY p.createdAt DESC", Post.class).getResultList();
    }

    public List<Post> findFeedPosts(String userId) {
        User user = findUserById(userId).orElse(null);
        if (user == null || user.getFollowingIds().isEmpty())
            return findAllPosts();
        return em.createQuery("SELECT p FROM Post p WHERE p.userId IN :ids ORDER BY p.createdAt DESC", Post.class)
                .setParameter("ids", user.getFollowingIds()).getResultList();
    }

    public List<Post> findPostsByUserId(String userId) {
        return em.createQuery("SELECT p FROM Post p WHERE p.userId = :id ORDER BY p.createdAt DESC", Post.class)
                .setParameter("id", userId).getResultList();
    }

    public List<Post> searchPosts(String keyword, String country, String city) {
        String q = "SELECT p FROM Post p WHERE 1=1";
        if (keyword != null && !keyword.isBlank())
            q += " AND (LOWER(p.title) LIKE LOWER(:kw) OR LOWER(p.content) LIKE LOWER(:kw))";
        if (country != null && !country.isBlank())
            q += " AND LOWER(p.country) LIKE LOWER(:ct)";
        if (city != null && !city.isBlank())
            q += " AND LOWER(p.city) LIKE LOWER(:ci)";
        q += " ORDER BY p.createdAt DESC";

        var query = em.createQuery(q, Post.class);
        if (keyword != null && !keyword.isBlank())
            query.setParameter("kw", "%" + keyword + "%");
        if (country != null && !country.isBlank())
            query.setParameter("ct", "%" + country + "%");
        if (city != null && !city.isBlank())
            query.setParameter("ci", "%" + city + "%");
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
                post.getPlaces().forEach(pl -> {
                    if (pl.getId() == null)
                        pl.setId(uuid());
                    pl.setPostId(postId);
                });
            }
            em.persist(post);
        } else {
            post = em.merge(post);
        }
        return post;
    }

    public Post toggleLike(String postId, String userId) {
        Post post = findPostById(postId).orElseThrow(() -> new IllegalArgumentException("post_not_found"));
        if (post.getLikedUserIds().contains(userId))
            post.getLikedUserIds().remove(userId);
        else
            post.getLikedUserIds().add(userId);
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

    public void deletePlan(String planId) {
        Plan plan = findPlanById(planId).orElseThrow(() -> new IllegalArgumentException("plan_not_found"));
        em.remove(plan);
    }
}