package com.spagenio.travel.model;

import jakarta.persistence.*;

@Entity
@Table(name = "plan_members")
public class PlanMember {
    @Id
    private String id;
    private String planId;
    private String userId;
    private String userNickname;
    private String userProfileImage;
    private String role; // owner | member
    private String joinedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPlanId() { return planId; }
    public void setPlanId(String planId) { this.planId = planId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserNickname() { return userNickname; }
    public void setUserNickname(String userNickname) { this.userNickname = userNickname; }
    public String getUserProfileImage() { return userProfileImage; }
    public void setUserProfileImage(String userProfileImage) { this.userProfileImage = userProfileImage; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getJoinedAt() { return joinedAt; }
    public void setJoinedAt(String joinedAt) { this.joinedAt = joinedAt; }
}
