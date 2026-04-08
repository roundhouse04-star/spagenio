package com.example.demo.service;

import com.example.demo.model.Booking;
import com.example.demo.model.TravelPackage;
import com.example.demo.repository.TravelRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TravelService {
    private final TravelRepository travelRepository;

    public TravelService(TravelRepository travelRepository) {
        this.travelRepository = travelRepository;
    }

    public List<TravelPackage> searchPackages(String destination, String budget, String category, Integer travelers) {
        return travelRepository.searchPackages(destination, budget, category, travelers);
    }

    public List<TravelPackage> featuredPackages() {
        return travelRepository.featuredPackages();
    }

    public TravelPackage findPackage(Long id) {
        return travelRepository.findPackageById(id)
                .orElseThrow(() -> new IllegalArgumentException("package_not_found"));
    }

    public List<Booking> findBookings() {
        return travelRepository.findBookings();
    }

    public Booking findBooking(Long id) {
        return travelRepository.findBookingById(id)
                .orElseThrow(() -> new IllegalArgumentException("booking_not_found"));
    }

    public Booking createBooking(Booking booking) {
        if (booking.getPackageId() == null) throw new IllegalArgumentException("package_id_required");
        if (booking.getCustomerName() == null || booking.getCustomerName().isBlank()) throw new IllegalArgumentException("customer_name_required");
        if (booking.getEmail() == null || booking.getEmail().isBlank()) throw new IllegalArgumentException("email_required");
        if (booking.getTravelers() <= 0) throw new IllegalArgumentException("travelers_required");
        findPackage(booking.getPackageId());
        return travelRepository.saveBooking(booking);
    }

    public Booking cancelBooking(Long id) {
        Booking booking = findBooking(id);
        if ("CANCELLED".equals(booking.getStatus())) throw new IllegalArgumentException("already_cancelled");
        return travelRepository.cancelBooking(id);
    }
}
