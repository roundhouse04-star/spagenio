package com.example.demo.model;

public class ItineraryItem {
    private int day;
    private String title;
    private String description;

    public ItineraryItem() {}

    public ItineraryItem(int day, String title, String description) {
        this.day = day;
        this.title = title;
        this.description = description;
    }

    public int getDay() { return day; }
    public void setDay(int day) { this.day = day; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
