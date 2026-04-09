package com.spagenio.travel.controller;

import com.spagenio.travel.service.ClaudeAiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class ClaudeAiController {

    private final ClaudeAiService claudeAiService;

    public ClaudeAiController(ClaudeAiService claudeAiService) {
        this.claudeAiService = claudeAiService;
    }

    /**
     * 실시간 교통편 정보 조회
     * POST /api/ai/transport
     * Body: { "from": "서울", "to": "도쿄" }
     */
    @PostMapping("/transport")
    public ResponseEntity<?> getTransportInfo(@RequestBody Map<String, String> body) {
        try {
            String from = body.getOrDefault("from", "").trim();
            String to = body.getOrDefault("to", "").trim();
            if (from.isBlank() || to.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "출발지와 목적지를 입력해주세요."));
            }
            String result = claudeAiService.getTransportInfo(from, to);
            // JSON 문자열을 그대로 반환 (프론트에서 JSON.parse)
            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "교통편 정보를 가져오는 중 오류가 발생했습니다."));
        }
    }

    /**
     * 여행지 팁 조회
     * POST /api/ai/tips
     * Body: { "destination": "도쿄", "category": "음식" }
     */
    @PostMapping("/tips")
    public ResponseEntity<?> getTravelTip(@RequestBody Map<String, String> body) {
        try {
            String destination = body.getOrDefault("destination", "").trim();
            String category = body.getOrDefault("category", "");
            if (destination.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "여행지를 입력해주세요."));
            }
            String result = claudeAiService.getTravelTip(destination, category);
            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "여행 팁을 가져오는 중 오류가 발생했습니다."));
        }
    }
}
