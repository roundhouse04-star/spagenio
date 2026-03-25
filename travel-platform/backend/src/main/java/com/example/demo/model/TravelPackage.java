package com.example.demo.model;

import java.util.List;

public class TravelPackage {
    private Long id;
    private String title;
    private String location;
    private String destination;
    private String summary;
    private String category;
    private String categoryLabel;
    private String budget;
    private int durationDays;
    private int durationNights;
    private int pricePerPerson;
    private double rating;
    private int minimumTravelers;
    private List<String> highlights;
    private List<String> inclusions;
    private List<String> exclusions;
    private List<ItineraryItem> itinerary;
    private boolean featured;

    public TravelPackage() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCategoryLabel() { return categoryLabel; }
    public void setCategoryLabel(String categoryLabel) { this.categoryLabel = categoryLabel; }
    public String getBudget() { return budget; }
    public void setBudget(String budget) { this.budget = budget; }
    public int getDurationDays() { return durationDays; }
    public void setDurationDays(int durationDays) { this.durationDays = durationDays; }
    public int getDurationNights() { return durationNights; }
    public void setDurationNights(int durationNights) { this.durationNights = durationNights; }
    public int getPricePerPerson() { return pricePerPerson; }
    public void setPricePerPerson(int pricePerPerson) { this.pricePerPerson = pricePerPerson; }
    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }
    public int getMinimumTravelers() { return minimumTravelers; }
    public void setMinimumTravelers(int minimumTravelers) { this.minimumTravelers = minimumTravelers; }
    public List<String> getHighlights() { return highlights; }
    public void setHighlights(List<String> highlights) { this.highlights = highlights; }
    public List<String> getInclusions() { return inclusions; }
    public void setInclusions(List<String> inclusions) { this.inclusions = inclusions; }
    public List<String> getExclusions() { return exclusions; }
    public void setExclusions(List<String> exclusions) { this.exclusions = exclusions; }
    public List<ItineraryItem> getItinerary() { return itinerary; }
    public void setItinerary(List<ItineraryItem> itinerary) { this.itinerary = itinerary; }
    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
}
