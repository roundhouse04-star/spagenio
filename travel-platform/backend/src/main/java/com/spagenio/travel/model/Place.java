package com.spagenio.travel.model;

import jakarta.persistence.*;

@Entity
@Table(name = "places")
public class Place {
    @Id
    private String id;

    @Column(name = "post_id", insertable = false, updatable = false)
    private String postId;

    @Column(name = "place_order")
    private int order;
    private String name;
    private String address;
    private double lat;
    private double lng;
    private String category;
    private String howToGet;
    private String tip;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPostId() { return postId; }
    public void setPostId(String postId) { this.postId = postId; }
    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }
    public double getLng() { return lng; }
    public void setLng(double lng) { this.lng = lng; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getHowToGet() { return howToGet; }
    public void setHowToGet(String howToGet) { this.howToGet = howToGet; }
    public String getTip() { return tip; }
    public void setTip(String tip) { this.tip = tip; }
}
