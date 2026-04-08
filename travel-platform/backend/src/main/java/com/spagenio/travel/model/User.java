package com.spagenio.travel.model;
import java.util.ArrayList;
import java.util.List;
public class User {
    private String id;
    private String nickname;
    private String profileImage;
    private String bio;
    private List<String> followingIds = new ArrayList<>();
    private List<String> followerIds = new ArrayList<>();
    private int visitedCountries;
    private String createdAt;
    public User() {}
    public String getId() { return id; } public void setId(String v) { this.id = v; }
    public String getNickname() { return nickname; } public void setNickname(String v) { this.nickname = v; }
    public String getProfileImage() { return profileImage; } public void setProfileImage(String v) { this.profileImage = v; }
    public String getBio() { return bio; } public void setBio(String v) { this.bio = v; }
    public List<String> getFollowingIds() { return followingIds; } public void setFollowingIds(List<String> v) { this.followingIds = v; }
    public List<String> getFollowerIds() { return followerIds; } public void setFollowerIds(List<String> v) { this.followerIds = v; }
    public int getVisitedCountries() { return visitedCountries; } public void setVisitedCountries(int v) { this.visitedCountries = v; }
    public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { this.createdAt = v; }
}
