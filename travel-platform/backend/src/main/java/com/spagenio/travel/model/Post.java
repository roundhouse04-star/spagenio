package com.spagenio.travel.model;
import java.util.ArrayList;
import java.util.List;
public class Post {
    private String id;
    private String userId;
    private String userNickname;
    private String userProfileImage;
    private String title;
    private String content;
    private String country;
    private String city;
    private List<String> images = new ArrayList<>();
    private List<Place> places = new ArrayList<>();
    private List<String> likedUserIds = new ArrayList<>();
    private List<Comment> comments = new ArrayList<>();
    private List<String> tags = new ArrayList<>();
    private String createdAt;
    public Post() {}
    public String getId() { return id; } public void setId(String v) { this.id = v; }
    public String getUserId() { return userId; } public void setUserId(String v) { this.userId = v; }
    public String getUserNickname() { return userNickname; } public void setUserNickname(String v) { this.userNickname = v; }
    public String getUserProfileImage() { return userProfileImage; } public void setUserProfileImage(String v) { this.userProfileImage = v; }
    public String getTitle() { return title; } public void setTitle(String v) { this.title = v; }
    public String getContent() { return content; } public void setContent(String v) { this.content = v; }
    public String getCountry() { return country; } public void setCountry(String v) { this.country = v; }
    public String getCity() { return city; } public void setCity(String v) { this.city = v; }
    public List<String> getImages() { return images; } public void setImages(List<String> v) { this.images = v; }
    public List<Place> getPlaces() { return places; } public void setPlaces(List<Place> v) { this.places = v; }
    public List<String> getLikedUserIds() { return likedUserIds; } public void setLikedUserIds(List<String> v) { this.likedUserIds = v; }
    public List<Comment> getComments() { return comments; } public void setComments(List<Comment> v) { this.comments = v; }
    public List<String> getTags() { return tags; } public void setTags(List<String> v) { this.tags = v; }
    public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { this.createdAt = v; }
}
