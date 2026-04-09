package com.spagenio.travel.service;

import com.spagenio.travel.model.*;
import com.spagenio.travel.repository.TravelRepository;
import org.springframework.stereotype.Service;
import java.util.List;

import java.util.List;
import java.util.Map;

@Service
public class TravelService {
    private final TravelRepository repo;
    public TravelService(TravelRepository repo) { this.repo = repo; }

    // User
    public List<User> getUsers() { return repo.findAllUsers(); }
    public User getUser(String id) { return repo.findUserById(id).orElseThrow(() -> new IllegalArgumentException("user_not_found")); }
    public User getUserByNickname(String nickname) { return repo.findUserByNickname(nickname).orElseThrow(() -> new IllegalArgumentException("user_not_found")); }
    public User createUser(User user) {
        if (user.getNickname() == null || user.getNickname().isBlank()) throw new IllegalArgumentException("nickname_required");
        repo.findUserByNickname(user.getNickname()).ifPresent(u -> { throw new IllegalArgumentException("nickname_duplicate"); });
        return repo.saveUser(user);
    }
    public User updateUser(String id, User user) {
        User existing = getUser(id);
        if (user.getNickname() != null) existing.setNickname(user.getNickname());
        if (user.getBio() != null) existing.setBio(user.getBio());
        if (user.getProfileImage() != null) existing.setProfileImage(user.getProfileImage());
        return repo.saveUser(existing);
    }
    public User follow(String userId, String targetId) { return repo.followUser(userId, targetId); }
    public User unfollow(String userId, String targetId) { return repo.unfollowUser(userId, targetId); }
    public User block(String userId, String targetId) { return repo.blockUser(userId, targetId); }
    public User unblock(String userId, String targetId) { return repo.unblockUser(userId, targetId); }
    public List<User> getFollowers(String userId) { return repo.findFollowers(userId); }
    public List<User> getFollowings(String userId) { return repo.findFollowings(userId); }

    // Post
    public List<Post> getAllPosts() { return repo.findAllPosts(null); }
    public List<Post> getAllPosts(String currentUserId) { return repo.findAllPosts(currentUserId); }
    public List<Post> getFeedPosts(String userId) { return repo.findFeedPosts(userId); }
    public List<Post> getPostsByUser(String userId) { return repo.findPostsByUserId(userId); }
    public List<Post> searchPosts(String keyword, String country, String city) { return repo.searchPosts(keyword, country, city, null); }
    public List<Post> searchPosts(String keyword, String country, String city, String travelStyle) { return repo.searchPosts(keyword, country, city, travelStyle); }
    public Post getPost(String id) { return repo.findPostById(id).orElseThrow(() -> new IllegalArgumentException("post_not_found")); }
    public Post createPost(Post post) {
        if (post.getTitle() == null || post.getTitle().isBlank()) throw new IllegalArgumentException("title_required");
        if (post.getUserId() == null) throw new IllegalArgumentException("user_id_required");
        User user = getUser(post.getUserId());
        post.setUserNickname(user.getNickname());
        post.setUserProfileImage(user.getProfileImage());
        return repo.savePost(post);
    }
    public Post toggleLike(String postId, String userId) { return repo.toggleLike(postId, userId); }
    public Post addComment(String postId, Comment comment) {
        if (comment.getContent() == null || comment.getContent().isBlank()) throw new IllegalArgumentException("content_required");
        User user = getUser(comment.getUserId());
        comment.setUserNickname(user.getNickname());
        comment.setUserProfileImage(user.getProfileImage());
        return repo.addComment(postId, comment);
    }
    public Post deleteComment(String postId, String commentId) { return repo.deleteComment(postId, commentId); }
    public Post updatePost(String postId, String title, String content) { return repo.updatePost(postId, title, content); }
    public void deletePost(String postId) { repo.deletePost(postId); }

    // Bookmark
    public User toggleBookmark(String userId, String postId) {
        User user = getUser(userId);
        if (user.getSavedPostIds().contains(postId)) {
            user.getSavedPostIds().remove(postId);
        } else {
            user.getSavedPostIds().add(postId);
        }
        User saved = repo.saveUser(user);
        checkAndAwardBadges(userId);
        return saved;
    }

    // Badge 자동 지급
    public void checkAndAwardBadges(String userId) {
        try {
            User user = getUser(userId);
            List<String> badges = user.getBadges();
            List<Post> posts = repo.findPostsByUserId(userId);
            int postCount = posts.size();
            int totalLikes = posts.stream().mapToInt(p -> p.getLikedUserIds().size()).sum();
            int followers = user.getFollowerIds().size();
            int countries = user.getVisitedCountries();
            boolean changed = false;
            if (postCount >= 1 && !badges.contains("first_post")) { badges.add("first_post"); changed = true; }
            if (postCount >= 10 && !badges.contains("ten_posts")) { badges.add("ten_posts"); changed = true; }
            if (postCount >= 50 && !badges.contains("fifty_posts")) { badges.add("fifty_posts"); changed = true; }
            if (totalLikes >= 100 && !badges.contains("likes_100")) { badges.add("likes_100"); changed = true; }
            if (totalLikes >= 1000 && !badges.contains("likes_1000")) { badges.add("likes_1000"); changed = true; }
            if (followers >= 10 && !badges.contains("followers_10")) { badges.add("followers_10"); changed = true; }
            if (followers >= 100 && !badges.contains("followers_100")) { badges.add("followers_100"); changed = true; }
            if (countries >= 5 && !badges.contains("countries_5")) { badges.add("countries_5"); changed = true; }
            if (countries >= 10 && !badges.contains("countries_10")) { badges.add("countries_10"); changed = true; }
            if (countries >= 30 && !badges.contains("countries_30")) { badges.add("countries_30"); changed = true; }
            if (changed) { user.setBadges(badges); repo.saveUser(user); }
        } catch (Exception e) { /* 뱃지 오류는 무시 */ }
    }

    // Companion
    // (동행 구하기는 보안상 이유로 제거됨)

    // Plan
    public List<Plan> getPlans(String userId) { return repo.findPlansByUserId(userId); }
    public Plan getPlan(String id) { return repo.findPlanById(id).orElseThrow(() -> new IllegalArgumentException("plan_not_found")); }
    public Plan createPlan(Plan plan) {
        if (plan.getTitle() == null || plan.getTitle().isBlank()) throw new IllegalArgumentException("title_required");
        if (plan.getUserId() == null) throw new IllegalArgumentException("user_id_required");
        User user = getUser(plan.getUserId());
        plan.setUserNickname(user.getNickname());
        plan.setUserProfileImage(user.getProfileImage());
        return repo.savePlan(plan);
    }
    public Plan updatePlan(String id, Plan plan) {
        Plan existing = getPlan(id);
        if (plan.getTitle() != null) existing.setTitle(plan.getTitle());
        if (plan.getStartDate() != null) existing.setStartDate(plan.getStartDate());
        if (plan.getEndDate() != null) existing.setEndDate(plan.getEndDate());
        if (plan.getShareType() != null) existing.setShareType(plan.getShareType());
        existing.setShareSchedule(plan.isShareSchedule());
        existing.setSharePlaces(plan.isSharePlaces());
        return repo.savePlan(existing);
    }
    public Plan addPlanItem(String planId, PlanItem item) { return repo.addPlanItem(planId, item); }
    public Plan removePlanItem(String planId, String itemId) { return repo.removePlanItem(planId, itemId); }
    public void deletePlan(String planId) { repo.deletePlan(planId); }
    public List<Plan> getFriendSharedPlans(String userId) { return repo.findSharedPlansByFriends(userId); }

    // Plan 협업
    public Plan inviteMember(String planId, String inviteeId) {
        User invitee = getUser(inviteeId);
        return repo.inviteMember(planId, invitee);
    }
    public Plan removeMember(String planId, String userId) { return repo.removeMember(planId, userId); }
    public List<PlanMessage> getMessages(String planId) { return repo.findMessages(planId); }
    public PlanMessage sendMessage(String planId, String userId, String content, String type) {
        User user = getUser(userId);
        PlanMessage msg = new PlanMessage();
        msg.setPlanId(planId);
        msg.setUserId(userId);
        msg.setUserNickname(user.getNickname());
        msg.setUserProfileImage(user.getProfileImage());
        msg.setContent(content);
        msg.setType(type != null ? type : "text");
        return repo.saveMessage(msg);
    }
    public List<Plan> getMemberPlans(String userId) { return repo.findPlansByMember(userId); }

    // Report
    public List<Report> getReports() { return repo.findAllReports(); }
    public List<Report> getPendingReports() { return repo.findPendingReports(); }
    public Report createReport(Report report) { return repo.saveReport(report); }
    public Report resolveReport(String id, String action) { return repo.resolveReport(id, action); }

    // Notice
    public List<Notice> getNotices() { return repo.findAllNotices(); }
    public List<Notice> getActiveNotices() { return repo.findActiveNotices(); }
    public Notice createNotice(Notice notice) { return repo.saveNotice(notice); }
    public Notice updateNotice(String id, Notice notice) {
        Notice existing = repo.findNoticeById(id).orElseThrow(() -> new IllegalArgumentException("notice_not_found"));
        if (notice.getTitle() != null) existing.setTitle(notice.getTitle());
        if (notice.getContent() != null) existing.setContent(notice.getContent());
        if (notice.getType() != null) existing.setType(notice.getType());
        existing.setActive(notice.isActive());
        return repo.saveNotice(existing);
    }
    public void deleteNotice(String id) { repo.deleteNotice(id); }

    // Admin Stats
    public Map<String, Object> getAdminStats() { return repo.getAdminStats(); }

    // Admin Post
    public Post hidePost(String id) {
        Post post = getPost(id);
        post.setVisibility("private");
        return repo.savePost(post);
    }
}
