package com.spagenio.travel.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Transit routes API — pre-curated routes with prices + OpenFlights airline data.
 * Includes admin CRUD endpoints.
 */
@RestController
@RequestMapping("/api/transit")
public class TransitRouteController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    public TransitRouteController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ==========================================
    // PUBLIC: Search routes by city pair
    // ==========================================

    @GetMapping("/routes")
    public List<Map<String, Object>> getRoutes(
            @RequestParam String from,
            @RequestParam String to) {

        String sql = """
            SELECT id, from_city AS "fromCity", to_city AS "toCity",
                   type, icon, name, tag, tag_color AS tagColor,
                   time_text AS time, price_text AS price, price_num AS priceNum,
                   steps, sort_order AS sortOrder
            FROM transit_routes
            WHERE LOWER(from_city) = LOWER(?) AND LOWER(to_city) = LOWER(?)
            ORDER BY sort_order
            """;
        List<Map<String, Object>> rows = jdbc.queryForList(sql, from, to);
        parseStepsJson(rows);
        return rows;
    }

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

    // ==========================================
    // ADMIN: Full CRUD + list
    // ==========================================

    /**
     * List all routes (with pagination + optional filter).
     * GET /api/transit/admin/routes?page=0&size=50&from=Seoul
     */
    @GetMapping("/admin/routes")
    public Map<String, Object> listAllRoutes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (from != null && !from.isBlank()) {
            where.append(" AND LOWER(from_city) LIKE LOWER(?)");
            params.add("%" + from + "%");
        }
        if (to != null && !to.isBlank()) {
            where.append(" AND LOWER(to_city) LIKE LOWER(?)");
            params.add("%" + to + "%");
        }

        // Total count
        String countSql = "SELECT COUNT(*) FROM transit_routes" + where;
        Integer total = jdbc.queryForObject(countSql, Integer.class, params.toArray());

        // Page
        String listSql = """
            SELECT id, from_city AS "fromCity", to_city AS "toCity",
                   type, icon, name, tag, tag_color AS tagColor,
                   time_text AS time, price_text AS price, price_num AS priceNum,
                   steps, sort_order AS sortOrder, generated_at AS generatedAt
            FROM transit_routes""" + where + " ORDER BY from_city, to_city, sort_order LIMIT ? OFFSET ?";

        params.add(size);
        params.add(page * size);
        List<Map<String, Object>> rows = jdbc.queryForList(listSql, params.toArray());
        parseStepsJson(rows);

        Map<String, Object> res = new HashMap<>();
        res.put("total", total);
        res.put("page", page);
        res.put("size", size);
        res.put("routes", rows);
        return res;
    }

    /**
     * Get single route by id.
     */
    @GetMapping("/admin/routes/{id}")
    public ResponseEntity<Map<String, Object>> getRoute(@PathVariable Long id) {
        String sql = """
            SELECT id, from_city AS "fromCity", to_city AS "toCity",
                   type, icon, name, tag, tag_color AS tagColor,
                   time_text AS time, price_text AS price, price_num AS priceNum,
                   steps, sort_order AS sortOrder
            FROM transit_routes WHERE id = ?
            """;
        List<Map<String, Object>> rows = jdbc.queryForList(sql, id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        parseStepsJson(rows);
        return ResponseEntity.ok(rows.get(0));
    }

    /**
     * Create new route.
     */
    @PostMapping("/admin/routes")
    public Map<String, Object> createRoute(@RequestBody Map<String, Object> body) throws Exception {
        String stepsJson = body.get("steps") instanceof List
            ? mapper.writeValueAsString(body.get("steps"))
            : String.valueOf(body.getOrDefault("steps", "[]"));

        jdbc.update("""
            INSERT INTO transit_routes (from_city, to_city, type, icon, name, tag, tag_color,
                time_text, price_text, price_num, steps, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            body.get("fromCity"), body.get("toCity"),
            body.get("type"), body.get("icon"), body.get("name"),
            body.get("tag"), body.get("tagColor"),
            body.get("time"), body.get("price"),
            body.get("priceNum") != null ? ((Number) body.get("priceNum")).intValue() : 0,
            stepsJson,
            body.get("sortOrder") != null ? ((Number) body.get("sortOrder")).intValue() : 1
        );

        Long newId = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        Map<String, Object> res = new HashMap<>(body);
        res.put("id", newId);
        return res;
    }

    /**
     * Update route.
     */
    @PutMapping("/admin/routes/{id}")
    public ResponseEntity<Map<String, Object>> updateRoute(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) throws Exception {

        String stepsJson = body.get("steps") instanceof List
            ? mapper.writeValueAsString(body.get("steps"))
            : String.valueOf(body.getOrDefault("steps", "[]"));

        int updated = jdbc.update("""
            UPDATE transit_routes SET
                from_city = ?, to_city = ?, type = ?, icon = ?, name = ?,
                tag = ?, tag_color = ?, time_text = ?, price_text = ?, price_num = ?,
                steps = ?, sort_order = ?, generated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            body.get("fromCity"), body.get("toCity"),
            body.get("type"), body.get("icon"), body.get("name"),
            body.get("tag"), body.get("tagColor"),
            body.get("time"), body.get("price"),
            body.get("priceNum") != null ? ((Number) body.get("priceNum")).intValue() : 0,
            stepsJson,
            body.get("sortOrder") != null ? ((Number) body.get("sortOrder")).intValue() : 1,
            id
        );

        if (updated == 0) return ResponseEntity.notFound().build();

        Map<String, Object> res = new HashMap<>(body);
        res.put("id", id);
        return ResponseEntity.ok(res);
    }

    /**
     * Delete route.
     */
    @DeleteMapping("/admin/routes/{id}")
    public ResponseEntity<Void> deleteRoute(@PathVariable Long id) {
        int deleted = jdbc.update("DELETE FROM transit_routes WHERE id = ?", id);
        return deleted > 0 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    // ==========================================
    // Helper
    // ==========================================

    private void parseStepsJson(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            Object stepsJson = row.get("steps");
            if (stepsJson instanceof String) {
                try {
                    List<?> stepsList = mapper.readValue((String) stepsJson, List.class);
                    row.put("steps", stepsList);
                } catch (Exception e) {
                    row.put("steps", List.of());
                }
            }
        }
    }
}
