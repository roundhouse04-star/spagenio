package com.spagenio.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

@Service
public class ClaudeAiService {

    // yml/properties 설정 불필요 — CLAUDE_API_KEY 환경변수만 있으면 동작
    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-sonnet-4-20250514";
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    private String getApiKey() {
        String key = System.getenv("CLAUDE_API_KEY");
        if (key != null && !key.isBlank()) return key;
        key = System.getProperty("claude.api.key");
        if (key != null && !key.isBlank()) return key;
        return "";
    }

    public String getTransportInfo(String from, String to) throws Exception {
        String apiKey = getApiKey();
        if (apiKey.isBlank()) return getFallbackTransportInfo(from, to);

        String systemPrompt = "당신은 여행 교통편 전문가입니다. 출발지와 목적지 사이의 교통 수단 정보를 JSON 형식으로 제공하세요.\n" +
            "반드시 다음 JSON 배열 형식만 반환하세요 (다른 텍스트 없이):\n" +
            "[{\"type\":\"airplane|train|bus|ferry\",\"icon\":\"✈|🚄|🚌|🚢\",\"name\":\"교통편 이름\"," +
            "\"tag\":\"추천|최저가|최단시간|\",\"tagColor\":\"#4f46e5|#f59e0b|#10b981|\"," +
            "\"time\":\"소요 시간\",\"price\":\"가격 범위 (원)\",\"priceNum\":숫자," +
            "\"steps\":[\"단계1\",\"단계2\"],\"links\":[{\"t\":\"링크명\",\"u\":\"https://...\"}]}]\n" +
            "최대 3개 옵션. 한국어로 답변하세요.";

        String userMessage = from + "에서 " + to + "까지 이동 방법을 알려주세요.";

        Map<String, Object> requestBody = Map.of(
            "model", MODEL,
            "max_tokens", 2000,
            "system", systemPrompt,
            "messages", List.of(Map.of("role", "user", "content", userMessage))
        );

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(CLAUDE_API_URL))
            .header("Content-Type", "application/json")
            .header("x-api-key", apiKey)
            .header("anthropic-version", "2023-06-01")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(requestBody)))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) return getFallbackTransportInfo(from, to);

        Map<?, ?> responseMap = mapper.readValue(response.body(), Map.class);
        List<?> content = (List<?>) responseMap.get("content");
        if (content == null || content.isEmpty()) return getFallbackTransportInfo(from, to);
        String text = (String) ((Map<?, ?>) content.get(0)).get("text");
        if (text == null || text.isBlank()) return getFallbackTransportInfo(from, to);

        return text.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
    }

    public String getTravelTip(String destination, String category) throws Exception {
        String apiKey = getApiKey();
        if (apiKey.isBlank()) return getFallbackTip(destination, category);

        String systemPrompt = "당신은 여행 전문가입니다. 여행지 팁을 JSON으로만 반환하세요.\n" +
            "{\"destination\":\"여행지\",\"tips\":[{\"icon\":\"💡\",\"title\":\"제목\",\"content\":\"내용\"}]," +
            "\"bestSeason\":\"시기\",\"currency\":\"통화\",\"language\":\"언어\",\"timezone\":\"시간대\"}";

        String cat = (category != null && !category.isBlank()) ? category : "전반적인";
        String userMessage = destination + " 여행 팁을 " + cat + " 카테고리로 알려주세요.";

        Map<String, Object> requestBody = Map.of(
            "model", MODEL,
            "max_tokens", 1500,
            "system", systemPrompt,
            "messages", List.of(Map.of("role", "user", "content", userMessage))
        );

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(CLAUDE_API_URL))
            .header("Content-Type", "application/json")
            .header("x-api-key", apiKey)
            .header("anthropic-version", "2023-06-01")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(requestBody)))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) return getFallbackTip(destination, category);

        Map<?, ?> responseMap = mapper.readValue(response.body(), Map.class);
        List<?> content = (List<?>) responseMap.get("content");
        if (content == null || content.isEmpty()) return getFallbackTip(destination, category);
        String text = (String) ((Map<?, ?>) content.get(0)).get("text");
        if (text == null || text.isBlank()) return getFallbackTip(destination, category);

        return text.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
    }

    private String getFallbackTransportInfo(String from, String to) {
        return "[{\"type\":\"airplane\",\"icon\":\"✈\",\"name\":\"" + from + " → " + to + " 항공편\"," +
            "\"tag\":\"추천\",\"tagColor\":\"#4f46e5\",\"time\":\"검색 필요\"," +
            "\"price\":\"스카이스캐너에서 확인하세요\",\"priceNum\":0," +
            "\"steps\":[\"" + from + " 공항 출발\",\"항공권 예약\",\"" + to + " 도착\"]," +
            "\"links\":[{\"t\":\"스카이스캐너\",\"u\":\"https://www.skyscanner.co.kr\"}," +
            "{\"t\":\"네이버항공\",\"u\":\"https://flight.naver.com\"}]}]";
    }

    private String getFallbackTip(String destination, String category) {
        return "{\"destination\":\"" + destination + "\",\"tips\":[" +
            "{\"icon\":\"💡\",\"title\":\"현지 교통\",\"content\":\"대중교통 앱을 미리 설치하세요\"}," +
            "{\"icon\":\"💰\",\"title\":\"환전\",\"content\":\"공항 또는 현지 ATM 이용 추천\"}," +
            "{\"icon\":\"🌐\",\"title\":\"인터넷\",\"content\":\"포켓 와이파이 또는 현지 유심 추천\"}]," +
            "\"bestSeason\":\"봄, 가을\",\"currency\":\"현지 통화\",\"language\":\"현지어 기초 표현 숙지\",\"timezone\":\"현지 시간 확인\"}";
    }
}
