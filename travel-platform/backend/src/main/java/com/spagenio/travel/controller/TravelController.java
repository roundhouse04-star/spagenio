package com.spagenio.travel.controller;

import com.spagenio.travel.model.*;
import com.spagenio.travel.service.TravelService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TravelController {
    private final TravelService service;
    public TravelController(TravelService service) { this.service = service; }

    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "ok"); }

    // ── User ────────────────────────────────────────────────
    @GetMapping("/users")
    public List<User> getUsers() { return service.getUsers(); }

    @GetMapping("/users/{id}")
    public User getUser(@PathVariable String id) { return service.getUser(id); }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public User createUser(@RequestBody User user) { return service.createUser(user); }

    @PatchMapping("/users/{id}")
    public User updateUser(@PathVariable String id, @RequestBody User user) { return service.updateUser(id, user); }

    @PostMapping("/users/{userId}/follow/{targetId}")
    public User follow(@PathVariable String userId, @PathVariable String targetId) { return service.follow(userId, targetId); }

    @PostMapping("/users/{userId}/unfollow/{targetId}")
    public User unfollow(@PathVariable String userId, @PathVariable String targetId) { return service.unfollow(userId, targetId); }

    @PostMapping("/users/{userId}/block/{targetId}")
    public User block(@PathVariable String userId, @PathVariable String targetId) { return service.block(userId, targetId); }

    @PostMapping("/users/{userId}/unblock/{targetId}")
    public User unblock(@PathVariable String userId, @PathVariable String targetId) { return service.unblock(userId, targetId); }

    @GetMapping("/users/{userId}/followers")
    public List<User> getFollowers(@PathVariable String userId) { return service.getFollowers(userId); }

    @GetMapping("/users/{userId}/followings")
    public List<User> getFollowings(@PathVariable String userId) { return service.getFollowings(userId); }

    @GetMapping("/users/{userId}/posts")
    public List<Post> getUserPosts(@PathVariable String userId) { return service.getPostsByUser(userId); }

    @GetMapping("/users/{userId}/plans")
    public List<Plan> getUserPlans(@PathVariable String userId) { return service.getPlans(userId); }

    // ── Post ────────────────────────────────────────────────
    @GetMapping("/posts")
    public List<Post> getPosts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String userId) {
        if (userId != null) return service.getFeedPosts(userId);
        if (keyword != null || country != null || city != null) return service.searchPosts(keyword, country, city);
        return service.getAllPosts();
    }

    @GetMapping("/posts/{id}")
    public Post getPost(@PathVariable String id) { return service.getPost(id); }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public Post createPost(@RequestBody Post post) { return service.createPost(post); }

    @PostMapping("/posts/{id}/like")
    public Post toggleLike(@PathVariable String id, @RequestBody Map<String, String> body) {
        return service.toggleLike(id, body.get("userId"));
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public Post addComment(@PathVariable String id, @RequestBody Comment comment) {
        return service.addComment(id, comment);
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@PathVariable String id) { service.deletePost(id); }

    // ── Plan ────────────────────────────────────────────────
    @GetMapping("/plans/{id}")
    public Plan getPlan(@PathVariable String id) { return service.getPlan(id); }

    @PostMapping("/plans")
    @ResponseStatus(HttpStatus.CREATED)
    public Plan createPlan(@RequestBody Plan plan) { return service.createPlan(plan); }

    @PatchMapping("/plans/{id}")
    public Plan updatePlan(@PathVariable String id, @RequestBody Plan plan) { return service.updatePlan(id, plan); }

    @PostMapping("/plans/{id}/items")
    public Plan addPlanItem(@PathVariable String id, @RequestBody PlanItem item) { return service.addPlanItem(id, item); }

    @DeleteMapping("/plans/{planId}/items/{itemId}")
    public Plan removePlanItem(@PathVariable String planId, @PathVariable String itemId) {
        return service.removePlanItem(planId, itemId);
    }

    @DeleteMapping("/plans/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlan(@PathVariable String id) { service.deletePlan(id); }

    // ── Report ────────────────────────────────────────────
    @GetMapping("/reports")
    public List<Report> getReports(@RequestParam(required = false) String status) {
        return "pending".equals(status) ? service.getPendingReports() : service.getReports();
    }

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public Report createReport(@RequestBody Report report) { return service.createReport(report); }

    @PostMapping("/reports/{id}/resolve")
    public Report resolveReport(@PathVariable String id, @RequestBody Map<String, String> body) {
        return service.resolveReport(id, body.getOrDefault("action", "resolved"));
    }

    // ── Notice ────────────────────────────────────────────
    @GetMapping("/notices")
    public List<Notice> getNotices(@RequestParam(required = false) String active) {
        return "true".equals(active) ? service.getActiveNotices() : service.getNotices();
    }

    @PostMapping("/notices")
    @ResponseStatus(HttpStatus.CREATED)
    public Notice createNotice(@RequestBody Notice notice) { return service.createNotice(notice); }

    @PatchMapping("/notices/{id}")
    public Notice updateNotice(@PathVariable String id, @RequestBody Notice notice) {
        return service.updateNotice(id, notice);
    }

    @DeleteMapping("/notices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNotice(@PathVariable String id) { service.deleteNotice(id); }

    // ── Admin Stats ───────────────────────────────────────
    @GetMapping("/admin/stats/posts")
    public Map<String, Object> getAdminPostStats() { return service.getAdminStats(); }

    // 게시물 강제 비공개
    @PostMapping("/admin/posts/{id}/hide")
    public Post hidePost(@PathVariable String id) { return service.hidePost(id); }

    // 게시물 강제 삭제
    @DeleteMapping("/admin/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void adminDeletePost(@PathVariable String id) { service.deletePost(id); }
}
