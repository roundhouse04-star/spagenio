package com.spagenio.travel.model;
public class PlanItem {
    private String id;
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
    public PlanItem() {}
    public String getId() { return id; } public void setId(String v) { this.id = v; }
    public String getPlaceName() { return placeName; } public void setPlaceName(String v) { this.placeName = v; }
    public double getLat() { return lat; } public void setLat(double v) { this.lat = v; }
    public double getLng() { return lng; } public void setLng(double v) { this.lng = v; }
    public String getAddress() { return address; } public void setAddress(String v) { this.address = v; }
    public String getHowToGet() { return howToGet; } public void setHowToGet(String v) { this.howToGet = v; }
    public String getTip() { return tip; } public void setTip(String v) { this.tip = v; }
    public String getCategory() { return category; } public void setCategory(String v) { this.category = v; }
    public String getFromPostId() { return fromPostId; } public void setFromPostId(String v) { this.fromPostId = v; }
    public String getFromPostTitle() { return fromPostTitle; } public void setFromPostTitle(String v) { this.fromPostTitle = v; }
    public String getFromUserNickname() { return fromUserNickname; } public void setFromUserNickname(String v) { this.fromUserNickname = v; }
    public String getDate() { return date; } public void setDate(String v) { this.date = v; }
    public String getMemo() { return memo; } public void setMemo(String v) { this.memo = v; }
}
