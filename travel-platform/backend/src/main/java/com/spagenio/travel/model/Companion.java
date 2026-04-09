package com.spagenio.travel.model;

import jakarta.persistence.*;

@Entity
@Table(name = "companions")
public class Companion {
    @Id private String id;
    private String userId;
    private String userNickname;
    private String userProfileImage;
    private String title;
    @Column(columnDefinition = "TEXT")
    private String description;
    private String destination;
    private String country;
    private String startDate;
    private String endDate;
    private int maxPeople = 2;
    private int currentPeople = 1;
    private String status = "open"; // open | closed
    private String createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserNickname() { return userNickname; }
    public void setUserNickname(String userNickname) { this.userNickname = userNickname; }
    public String getUserProfileImage() { return userProfileImage; }
    public void setUserProfileImage(String userProfileImage) { this.userProfileImage = userProfileImage; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public int getMaxPeople() { return maxPeople; }
    public void setMaxPeople(int maxPeople) { this.maxPeople = maxPeople; }
    public int getCurrentPeople() { return currentPeople; }
    public void setCurrentPeople(int currentPeople) { this.currentPeople = currentPeople; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
