package com.spagenio.travel.model;
public class Place {
    private int order;
    private String name;
    private String address;
    private double lat;
    private double lng;
    private String category;
    private String howToGet;
    private String tip;
    public Place() {}
    public int getOrder() { return order; } public void setOrder(int v) { this.order = v; }
    public String getName() { return name; } public void setName(String v) { this.name = v; }
    public String getAddress() { return address; } public void setAddress(String v) { this.address = v; }
    public double getLat() { return lat; } public void setLat(double v) { this.lat = v; }
    public double getLng() { return lng; } public void setLng(double v) { this.lng = v; }
    public String getCategory() { return category; } public void setCategory(String v) { this.category = v; }
    public String getHowToGet() { return howToGet; } public void setHowToGet(String v) { this.howToGet = v; }
    public String getTip() { return tip; } public void setTip(String v) { this.tip = v; }
}
