package com.spagenio.travel.controller;

import org.springframework.web.bind.annotation.*;
import java.sql.*;
import java.util.*;

@RestController
@RequestMapping("/api/transit")
@CrossOrigin(origins = "*")
public class TransitController {

    private static final String DB_PATH = System.getProperty("user.dir") + "/data/travellog.db";

    private Connection getConn() throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + DB_PATH);
    }

    @GetMapping("/cities")
    public List<Map<String, Object>> getCities() throws SQLException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = getConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT * FROM transit_cities ORDER BY name_ko")) {
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", rs.getString("id"));
                row.put("nameKo", rs.getString("name_ko"));
                row.put("nameEn", rs.getString("name_en"));
                row.put("country", rs.getString("country"));
                result.add(row);
            }
        }
        return result;
    }

    @GetMapping("/lines")
    public List<Map<String, Object>> getLines(@RequestParam String city) throws SQLException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = getConn();
             PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM transit_lines WHERE city_id=? ORDER BY line_order")) {
            ps.setString(1, city);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", rs.getString("id"));
                row.put("cityId", rs.getString("city_id"));
                row.put("nameKo", rs.getString("name_ko"));
                row.put("nameEn", rs.getString("name_en"));
                row.put("color", rs.getString("color"));
                row.put("textColor", rs.getString("text_color"));
                result.add(row);
            }
        }
        return result;
    }

    @GetMapping("/stations")
    public List<Map<String, Object>> getStations(@RequestParam String city) throws SQLException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = getConn();
             PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM transit_stations WHERE city_id=? ORDER BY name_ko")) {
            ps.setString(1, city);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", rs.getString("id"));
                row.put("cityId", rs.getString("city_id"));
                row.put("nameKo", rs.getString("name_ko"));
                row.put("nameEn", rs.getString("name_en"));
                row.put("x", rs.getDouble("x"));
                row.put("y", rs.getDouble("y"));
                row.put("isTransfer", rs.getInt("is_transfer") == 1);
                result.add(row);
            }
        }
        return result;
    }

    @GetMapping("/connections")
    public List<Map<String, Object>> getConnections(@RequestParam String city) throws SQLException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = getConn();
             PreparedStatement ps = conn.prepareStatement(
                "SELECT tc.* FROM transit_connections tc " +
                "JOIN transit_stations ts ON tc.from_station_id = ts.id " +
                "WHERE ts.city_id = ?")) {
            ps.setString(1, city);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", rs.getInt("id"));
                row.put("fromStationId", rs.getString("from_station_id"));
                row.put("toStationId", rs.getString("to_station_id"));
                row.put("lineId", rs.getString("line_id"));
                row.put("travelTime", rs.getInt("travel_time"));
                row.put("isTransfer", rs.getInt("is_transfer") == 1);
                result.add(row);
            }
        }
        return result;
    }
}
