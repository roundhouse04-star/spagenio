package com.spagenio.travel.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Transit routes API — replaces the hardcoded ROUTES_DB in frontend.
 * Serves pre-curated transit options (with AI-estimated prices) plus
 * raw flight route data (airlines only) from OpenFlights.
 */
@RestController
@RequestMapping("/api/transit")
public class TransitRouteController {

    private final JdbcTemplate jdbc;

    public TransitRouteController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Get pre-curated transit routes between two cities.
     * GET /api/transit/routes?from=Seoul&to=Tokyo
     */
    @GetMapping("/routes")
    public List<Map<String, Object>> getRoutes(
            @RequestParam String from,
            @RequestParam String to) {

        String sql = """
            SELECT type, icon, name, tag, tag_color AS tagColor,
                   time_text AS time, price_text AS price, price_num AS priceNum,
                   steps, sort_order
            FROM transit_routes
            WHERE LOWER(from_city) = LOWER(?) AND LOWER(to_city) = LOWER(?)
            ORDER BY sort_order
            """;
        List<Map<String, Object>> rows = jdbc.queryForList(sql, from, to);

        // Parse JSON steps array
        for (Map<String, Object> row : rows) {
            Object stepsJson = row.get("steps");
            if (stepsJson instanceof String) {
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    List<?> stepsList = mapper.readValue((String) stepsJson, List.class);
                    row.put("steps", stepsList);
                } catch (Exception e) {
                    row.put("steps", List.of());
                }
            }
        }
        return rows;
    }

    /**
     * Get all active airlines operating routes between two cities (OpenFlights data).
     * GET /api/transit/flights?from=Seoul&to=Tokyo
     * Returns: [{ airline, src, dst, stops, srcCity, dstCity, ... }]
     */
    @GetMapping("/flights")
    public List<Map<String, Object>> getFlights(
            @RequestParam String from,
            @RequestParam String to) {

        String sql = """
            SELECT DISTINCT
                al.name AS airline,
                al.iata_code AS airlineCode,
                fr.src_iata AS src,
                fr.dst_iata AS dst,
                a_src.city AS srcCity,
                a_src.country AS srcCountry,
                a_dst.city AS dstCity,
                a_dst.country AS dstCountry,
                a_src.name AS srcAirport,
                a_dst.name AS dstAirport,
                fr.stops
            FROM flight_routes fr
            JOIN airports a_src ON fr.src_iata = a_src.iata_code
            JOIN airports a_dst ON fr.dst_iata = a_dst.iata_code
            LEFT JOIN airlines al ON fr.airline_code = al.iata_code
            WHERE (LOWER(a_src.city) LIKE LOWER(?) OR LOWER(a_src.iata_code) = LOWER(?))
              AND (LOWER(a_dst.city) LIKE LOWER(?) OR LOWER(a_dst.iata_code) = LOWER(?))
              AND (al.active = 'Y' OR al.active IS NULL)
            ORDER BY fr.stops ASC, al.name ASC
            LIMIT 20
            """;

        return jdbc.queryForList(sql,
            "%" + from + "%", from,
            "%" + to + "%", to);
    }

    /**
     * Airport autocomplete by city or IATA code.
     * GET /api/transit/airports?q=seoul
     */
    @GetMapping("/airports")
    public List<Map<String, Object>> searchAirports(@RequestParam String q) {
        String sql = """
            SELECT iata_code AS iata, name, city, country
            FROM airports
            WHERE LOWER(city) LIKE LOWER(?) OR LOWER(iata_code) = LOWER(?)
            ORDER BY
              CASE WHEN LOWER(iata_code) = LOWER(?) THEN 1
                   WHEN LOWER(city) = LOWER(?) THEN 2
                   ELSE 3 END
            LIMIT 10
            """;
        return jdbc.queryForList(sql, "%" + q + "%", q, q, q);
    }
}
