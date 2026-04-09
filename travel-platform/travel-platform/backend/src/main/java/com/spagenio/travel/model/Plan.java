package com.spagenio.travel.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "plans")
public class Plan {
    @Id
    private String id;
    private String userId;
    private String title;
    private String startDate;
    private String endDate;
    private String createdAt;
    private String shareType = "private"; // private | friends | public
    private boolean shareSchedule = false;
    private boolean sharePlaces = false;
    private String userNickname = "";
    private String userProfileImage = "";

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = true)
    @JoinColumn(name = "plan_id", referencedColumnName = "id")
    private List<PlanItem> items = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = true)
    @JoinColumn(name = "plan_id", referencedColumnName = "id")
    private List<PlanMember> members = new ArrayList<>();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public String getShareType() { return shareType; }
    public void setShareType(String shareType) { this.shareType = shareType; }
    public boolean isShareSchedule() { return shareSchedule; }
    public void setShareSchedule(boolean shareSchedule) { this.shareSchedule = shareSchedule; }
    public boolean isSharePlaces() { return sharePlaces; }
    public void setSharePlaces(boolean sharePlaces) { this.sharePlaces = sharePlaces; }
    public String getUserNickname() { return userNickname; }
    public void setUserNickname(String userNickname) { this.userNickname = userNickname; }
    public String getUserProfileImage() { return userProfileImage; }
    public void setUserProfileImage(String userProfileImage) { this.userProfileImage = userProfileImage; }
    public List<PlanItem> getItems() { return items; }
    public void setItems(List<PlanItem> items) { this.items = items; }
    public List<PlanMember> getMembers() { return members; }
    public void setMembers(List<PlanMember> members) { this.members = members; }
}
