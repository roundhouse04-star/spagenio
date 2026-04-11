package com.spagenio.travel.controller;

import com.spagenio.travel.model.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api")
public class TransitController {

    @PersistenceContext
    private EntityManager em;

    @GetMapping("/transit/stations")
    public List<TransitStation> getStations(@RequestParam String city) {
        return em.createQuery("SELECT s FROM TransitStation s WHERE s.cityId = :city", TransitStation.class)
                .setParameter("city", city).getResultList();
    }

    @GetMapping("/transit/lines")
    public List<TransitLine> getLines(@RequestParam String city) {
        return em.createQuery("SELECT l FROM TransitLine l WHERE l.cityId = :city ORDER BY l.lineOrder", TransitLine.class)
                .setParameter("city", city).getResultList();
    }

    @GetMapping("/transit/connections")
    public List<TransitConnection> getConnections(@RequestParam String city) {
        return em.createQuery("SELECT c FROM TransitConnection c WHERE c.fromStationId IN (SELECT s.id FROM TransitStation s WHERE s.cityId = :city)", TransitConnection.class)
                .setParameter("city", city).getResultList();
    }
}
