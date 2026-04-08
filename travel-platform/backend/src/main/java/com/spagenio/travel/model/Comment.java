package com.spagenio.travel.model;
public class Comment {
    private String id;
    private String userId;
    private String userNickname;
    private String userProfileImage;
    private String content;
    private String createdAt;
    public Comment() {}
    public String getId() { return id; } public void setId(String v) { this.id = v; }
    public String getUserId() { return userId; } public void setUserId(String v) { this.userId = v; }
    public String getUserNickname() { return userNickname; } public void setUserNickname(String v) { this.userNickname = v; }
    public String getUserProfileImage() { return userProfileImage; } public void setUserProfileImage(String v) { this.userProfileImage = v; }
    public String getContent() { return content; } public void setContent(String v) { this.content = v; }
    public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { this.createdAt = v; }
}
