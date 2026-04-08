package com.spagenio.travel.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
public class User {
    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String nickname;

    @Column(unique = true, nullable = false)
    private String email;

    @JsonIgnore
    private String password;

    private String profileImage = "";
    private String bio = "";
    private String role = "user";
    private boolean suspended = false;
    private boolean agreeMarketing = false;
    private int visitedCountries = 0;
    private String createdAt;
    private String lastLogin;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_following", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "following_id")
    private List<String> followingIds = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_followers", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "follower_id")
    private List<String> followerIds = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_blocked", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "blocked_id")
    private List<String> blockedIds = new ArrayList<>();

    private String defaultFeed = "all";

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getProfileImage() { return profileImage; }
    public void setProfileImage(String profileImage) { this.profileImage = profileImage; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public boolean isSuspended() { return suspended; }
    public void setSuspended(boolean suspended) { this.suspended = suspended; }
    public boolean isAgreeMarketing() { return agreeMarketing; }
    public void setAgreeMarketing(boolean agreeMarketing) { this.agreeMarketing = agreeMarketing; }
    public int getVisitedCountries() { return visitedCountries; }
    public void setVisitedCountries(int visitedCountries) { this.visitedCountries = visitedCountries; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public String getLastLogin() { return lastLogin; }
    public void setLastLogin(String lastLogin) { this.lastLogin = lastLogin; }
    public List<String> getFollowingIds() { return followingIds; }
    public void setFollowingIds(List<String> followingIds) { this.followingIds = followingIds; }
    public List<String> getFollowerIds() { return followerIds; }
    public void setFollowerIds(List<String> followerIds) { this.followerIds = followerIds; }
    public List<String> getBlockedIds() { return blockedIds; }
    public void setBlockedIds(List<String> blockedIds) { this.blockedIds = blockedIds; }
    public String getDefaultFeed() { return defaultFeed; }
    public void setDefaultFeed(String defaultFeed) { this.defaultFeed = defaultFeed; }
}
