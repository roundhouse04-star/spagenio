package com.spagenio.travel.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * My Trip Log 관리자 API
 *
 * - GET /api/mtl-admin/stats          전체 통계
 * - GET /api/mtl-admin/users          사용자 목록 (페이징)
 * - GET /api/mtl-admin/by-nationality 국적별 분포
 * - GET /api/mtl-admin/by-os          OS별 분포
 * - GET /api/mtl-admin/by-app-version 앱 버전별 분포
 * - GET /api/mtl-admin/daily-signups  일별 가입 추이 (최근 30일)
 *
 * 모든 정보는 익명 (개인 식별 불가).
 */
@RestController
@RequestMapping("/api/mtl-admin")
public class AdminMyTripLogController {

    @Value("${spring.datasource.url}")
    private String dbUrl;

    /**
     * 전체 통계
     */
    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        Map<String, Object> result = new LinkedHashMap<>();

        try (Connection conn = DriverManager.getConnection(dbUrl)) {
            result.put("totalUsers", count(conn, "SELECT COUNT(*) FROM mytriplog_users"));
            result.put("todayJoined", count(conn,
                "SELECT COUNT(*) FROM mytriplog_users WHERE date(created_at) = date('now')"));
            result.put("weekJoined", count(conn,
                "SELECT COUNT(*) FROM mytriplog_users WHERE created_at >= datetime('now', '-7 days')"));
            result.put("monthJoined", count(conn,
                "SELECT COUNT(*) FROM mytriplog_users WHERE created_at >= datetime('now', '-30 days')"));
            result.put("activeWeekly", count(conn,
                "SELECT COUNT(*) FROM mytriplog_users WHERE last_seen_at >= datetime('now', '-7 days')"));
            result.put("activeMonthly", count(conn,
                "SELECT COUNT(*) FROM mytriplog_users WHERE last_seen_at >= datetime('now', '-30 days')"));
            result.put("snsAlertOptIns", count(conn,
                "SELECT COUNT(*) FROM mytriplog_users WHERE agree_sns_alert = 1"));
            result.put("avgTripCount", scalarDouble(conn,
                "SELECT COALESCE(AVG(trip_count), 0) FROM mytriplog_users"));
            result.put("avgLogCount", scalarDouble(conn,
                "SELECT COALESCE(AVG(log_count), 0) FROM mytriplog_users"));
            result.put("totalTrips", count(conn,
                "SELECT COALESCE(SUM(trip_count), 0) FROM mytriplog_users"));
            result.put("totalLogs", count(conn,
                "SELECT COALESCE(SUM(log_count), 0) FROM mytriplog_users"));

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 사용자 목록 (페이징)
     */
    @GetMapping("/users")
    public ResponseEntity<?> users(
        @RequestParam(defaultValue = "0") int offset,
        @RequestParam(defaultValue = "50") int limit
    ) {
        if (limit > 200) limit = 200;
        List<Map<String, Object>> rows = new ArrayList<>();

        try (Connection conn = DriverManager.getConnection(dbUrl);
             PreparedStatement ps = conn.prepareStatement(
                 "SELECT anon_id, nickname, nationality, os, os_version, app_version, " +
                 "       device_locale, trip_count, log_count, agree_sns_alert, " +
                 "       created_at, last_seen_at " +
                 "FROM mytriplog_users " +
                 "ORDER BY last_seen_at DESC " +
                 "LIMIT ? OFFSET ?")) {
            ps.setInt(1, limit);
            ps.setInt(2, offset);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("anonId", rs.getString("anon_id"));
                    row.put("nickname", rs.getString("nickname"));
                    row.put("nationality", rs.getString("nationality"));
                    row.put("os", rs.getString("os"));
                    row.put("osVersion", rs.getString("os_version"));
                    row.put("appVersion", rs.getString("app_version"));
                    row.put("deviceLocale", rs.getString("device_locale"));
                    row.put("tripCount", rs.getInt("trip_count"));
                    row.put("logCount", rs.getInt("log_count"));
                    row.put("agreeSnsAlert", rs.getInt("agree_sns_alert") == 1);
                    row.put("createdAt", rs.getString("created_at"));
                    row.put("lastSeenAt", rs.getString("last_seen_at"));
                    rows.add(row);
                }
            }

            int total = count(conn, "SELECT COUNT(*) FROM mytriplog_users");
            return ResponseEntity.ok(Map.of(
                "total", total,
                "offset", offset,
                "limit", limit,
                "users", rows
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/by-nationality")
    public ResponseEntity<?> byNationality() {
        return groupCount(
            "SELECT COALESCE(nationality, 'UNKNOWN') as label, COUNT(*) as count " +
            "FROM mytriplog_users GROUP BY label ORDER BY count DESC"
        );
    }

    @GetMapping("/by-os")
    public ResponseEntity<?> byOs() {
        return groupCount(
            "SELECT COALESCE(os, 'UNKNOWN') as label, COUNT(*) as count " +
            "FROM mytriplog_users GROUP BY label ORDER BY count DESC"
        );
    }

    @GetMapping("/by-app-version")
    public ResponseEntity<?> byAppVersion() {
        return groupCount(
            "SELECT COALESCE(app_version, 'UNKNOWN') as label, COUNT(*) as count " +
            "FROM mytriplog_users GROUP BY label ORDER BY count DESC"
        );
    }

    @GetMapping("/daily-signups")
    public ResponseEntity<?> dailySignups() {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection conn = DriverManager.getConnection(dbUrl);
             PreparedStatement ps = conn.prepareStatement(
                 "SELECT date(created_at) as day, COUNT(*) as count " +
                 "FROM mytriplog_users " +
                 "WHERE created_at >= datetime('now', '-30 days') " +
                 "GROUP BY day ORDER BY day ASC");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("day", rs.getString("day"));
                row.put("count", rs.getInt("count"));
                rows.add(row);
            }
            return ResponseEntity.ok(Map.of("data", rows));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ---------- helpers ----------

    private ResponseEntity<?> groupCount(String sql) {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection conn = DriverManager.getConnection(dbUrl);
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("label", rs.getString("label"));
                row.put("count", rs.getInt("count"));
                rows.add(row);
            }
            return ResponseEntity.ok(Map.of("data", rows));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    private int count(Connection conn, String sql) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private double scalarDouble(Connection conn, String sql) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getDouble(1) : 0;
        }
    }
}
