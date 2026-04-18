package com.spagenio.travel.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * My Trip Log 앱 - 공개 API
 *
 * 앱에서 직접 호출하는 엔드포인트:
 * - POST /api/app/mytriplog/register   가입 등록 (최초 1회)
 * - POST /api/app/mytriplog/heartbeat  앱 실행 시 상태 갱신
 *
 * 모두 익명 UUID 기반. 개인 식별 정보 없음.
 */
@RestController
@RequestMapping("/api/app/mytriplog")
public class MyTripLogController {

    @Value("${spring.datasource.url}")
    private String dbUrl;

    /**
     * 가입 등록
     * 앱 첫 실행 후 약관 동의가 끝났을 때 호출.
     * 동일 anon_id로 재호출되면 업데이트.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        String anonId       = str(body, "anonId");
        String nickname     = str(body, "nickname");
        String nationality  = str(body, "nationality");
        String os           = str(body, "os");
        String osVersion    = str(body, "osVersion");
        String appVersion   = str(body, "appVersion");
        String deviceLocale = str(body, "deviceLocale");
        boolean agreeStats     = bool(body, "agreeStats");
        boolean agreeSnsAlert  = bool(body, "agreeSnsAlert");

        if (anonId == null || anonId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "anonId is required"));
        }

        // 통계 거부 시 등록 자체를 거부
        if (!agreeStats) {
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "registered", false,
                "message", "stats opt-out"
            ));
        }

        String now = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

        try (Connection conn = DriverManager.getConnection(dbUrl)) {
            // UPSERT
            String sql = """
                INSERT INTO mytriplog_users
                  (anon_id, nickname, nationality, os, os_version, app_version,
                   device_locale, agree_stats, agree_sns_alert, created_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(anon_id) DO UPDATE SET
                  nickname        = excluded.nickname,
                  nationality     = excluded.nationality,
                  os              = excluded.os,
                  os_version      = excluded.os_version,
                  app_version     = excluded.app_version,
                  device_locale   = excluded.device_locale,
                  agree_stats     = excluded.agree_stats,
                  agree_sns_alert = excluded.agree_sns_alert,
                  last_seen_at    = excluded.last_seen_at
                """;
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, anonId);
                ps.setString(2, nickname);
                ps.setString(3, nationality);
                ps.setString(4, os);
                ps.setString(5, osVersion);
                ps.setString(6, appVersion);
                ps.setString(7, deviceLocale);
                ps.setInt(8, agreeStats ? 1 : 0);
                ps.setInt(9, agreeSnsAlert ? 1 : 0);
                ps.setString(10, now);
                ps.setString(11, now);
                ps.executeUpdate();
            }

            return ResponseEntity.ok(Map.of(
                "ok", true,
                "registered", true,
                "anonId", anonId
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "ok", false,
                "error", e.getMessage()
            ));
        }
    }

    /**
     * Heartbeat
     * 앱 실행 시마다 호출.
     * 사용 통계(여행 수, 기록 수)도 같이 업데이트.
     */
    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody Map<String, Object> body) {
        String anonId      = str(body, "anonId");
        String appVersion  = str(body, "appVersion");
        Integer tripCount  = num(body, "tripCount");
        Integer logCount   = num(body, "logCount");

        if (anonId == null || anonId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "anonId is required"));
        }

        String now = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

        try (Connection conn = DriverManager.getConnection(dbUrl)) {
            // 존재 여부 확인
            boolean exists;
            try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM mytriplog_users WHERE anon_id = ?")) {
                ps.setString(1, anonId);
                try (ResultSet rs = ps.executeQuery()) {
                    exists = rs.next();
                }
            }

            if (!exists) {
                return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "registered", false,
                    "message", "not registered"
                ));
            }

            String sql = """
                UPDATE mytriplog_users
                SET last_seen_at = ?,
                    app_version  = COALESCE(?, app_version),
                    trip_count   = COALESCE(?, trip_count),
                    log_count    = COALESCE(?, log_count)
                WHERE anon_id = ?
                """;
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, now);
                if (appVersion != null) ps.setString(2, appVersion); else ps.setNull(2, java.sql.Types.VARCHAR);
                if (tripCount != null) ps.setInt(3, tripCount); else ps.setNull(3, java.sql.Types.INTEGER);
                if (logCount != null) ps.setInt(4, logCount); else ps.setNull(4, java.sql.Types.INTEGER);
                ps.setString(5, anonId);
                ps.executeUpdate();
            }

            return ResponseEntity.ok(Map.of("ok", true, "registered", true));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "ok", false,
                "error", e.getMessage()
            ));
        }
    }

    // helpers
    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? null : String.valueOf(v).trim();
    }

    private static boolean bool(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return false;
        if (v instanceof Boolean) return (Boolean) v;
        String s = String.valueOf(v).toLowerCase();
        return "true".equals(s) || "1".equals(s);
    }

    private static Integer num(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(String.valueOf(v)); }
        catch (Exception e) { return null; }
    }
}
