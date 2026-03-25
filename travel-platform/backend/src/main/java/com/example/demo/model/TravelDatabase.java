package com.example.demo.model;

import java.util.ArrayList;
import java.util.List;

public class TravelDatabase {
    private List<TravelPackage> packages = new ArrayList<>();
    private List<Booking> bookings = new ArrayList<>();

    public List<TravelPackage> getPackages() { return packages; }
    public void setPackages(List<TravelPackage> packages) { this.packages = packages; }
    public List<Booking> getBookings() { return bookings; }
    public void setBookings(List<Booking> bookings) { this.bookings = bookings; }
}
