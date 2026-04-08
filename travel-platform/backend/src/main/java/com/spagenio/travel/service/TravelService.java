package com.spagenio.travel.service;

import com.spagenio.travel.model.*;
import com.spagenio.travel.repository.TravelRepository;
import org.springframework.stereotype.Service;

import java.util.List;

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
    public List<Post> searchPosts(String keyword, String country, String city) { return repo.searchPosts(keyword, country, city); }
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
    public void deletePost(String postId) { repo.deletePost(postId); }

    // Plan
    public List<Plan> getPlans(String userId) { return repo.findPlansByUserId(userId); }
    public Plan getPlan(String id) { return repo.findPlanById(id).orElseThrow(() -> new IllegalArgumentException("plan_not_found")); }
    public Plan createPlan(Plan plan) {
        if (plan.getTitle() == null || plan.getTitle().isBlank()) throw new IllegalArgumentException("title_required");
        if (plan.getUserId() == null) throw new IllegalArgumentException("user_id_required");
        return repo.savePlan(plan);
    }
    public Plan updatePlan(String id, Plan plan) {
        Plan existing = getPlan(id);
        if (plan.getTitle() != null) existing.setTitle(plan.getTitle());
        if (plan.getStartDate() != null) existing.setStartDate(plan.getStartDate());
        if (plan.getEndDate() != null) existing.setEndDate(plan.getEndDate());
        return repo.savePlan(existing);
    }
    public Plan addPlanItem(String planId, PlanItem item) { return repo.addPlanItem(planId, item); }
    public Plan removePlanItem(String planId, String itemId) { return repo.removePlanItem(planId, itemId); }
    public void deletePlan(String planId) { repo.deletePlan(planId); }
}
