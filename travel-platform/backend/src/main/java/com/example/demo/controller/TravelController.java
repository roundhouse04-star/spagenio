package com.example.demo.controller;

import com.example.demo.model.Booking;
import com.example.demo.model.TravelPackage;
import com.example.demo.service.TravelService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TravelController {
    private final TravelService travelService;

    public TravelController(TravelService travelService) {
        this.travelService = travelService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/packages")
    public List<TravelPackage> searchPackages(@RequestParam(required = false) String destination,
                                              @RequestParam(required = false) String budget,
                                              @RequestParam(required = false) String category,
                                              @RequestParam(required = false) Integer travelers) {
        return travelService.searchPackages(destination, budget, category, travelers);
    }

    @GetMapping("/packages/featured")
    public List<TravelPackage> featuredPackages() {
        return travelService.featuredPackages();
    }

    @GetMapping("/packages/{id}")
    public TravelPackage packageDetail(@PathVariable Long id) {
        return travelService.findPackage(id);
    }

    @GetMapping("/bookings")
    public List<Booking> bookings() {
        return travelService.findBookings();
    }

    @PostMapping("/bookings")
    @ResponseStatus(HttpStatus.CREATED)
    public Booking createBooking(@RequestBody Booking booking) {
        return travelService.createBooking(booking);
    }
}
