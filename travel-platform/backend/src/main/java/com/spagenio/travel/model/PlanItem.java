package com.spagenio.travel.model;

import jakarta.persistence.*;

@Entity
@Table(name = "plan_items")
public class PlanItem {
    @Id
    private String id;

    @Column(name = "plan_id", insertable = false, updatable = false)
    private String planId;

    private String placeName;
    private double lat;
    private double lng;
    private String address;
    private String howToGet;
    private String tip;
    private String category;
    private String fromPostId;
    private String fromPostTitle;
    private String fromUserNickname;
    private String date;
    private String memo;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPlanId() { return planId; }
    public void setPlanId(String planId) { this.planId = planId; }
    public String getPlaceName() { return placeName; }
    public void setPlaceName(String placeName) { this.placeName = placeName; }
    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }
    public double getLng() { return lng; }
    public void setLng(double lng) { this.lng = lng; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getHowToGet() { return howToGet; }
    public void setHowToGet(String howToGet) { this.howToGet = howToGet; }
    public String getTip() { return tip; }
    public void setTip(String tip) { this.tip = tip; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getFromPostId() { return fromPostId; }
    public void setFromPostId(String fromPostId) { this.fromPostId = fromPostId; }
    public String getFromPostTitle() { return fromPostTitle; }
    public void setFromPostTitle(String fromPostTitle) { this.fromPostTitle = fromPostTitle; }
    public String getFromUserNickname() { return fromUserNickname; }
    public void setFromUserNickname(String fromUserNickname) { this.fromUserNickname = fromUserNickname; }
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
}
