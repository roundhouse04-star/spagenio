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

    // No yml/properties config needed — just set CLAUDE_API_KEY env var
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

        String systemPrompt = "You are a travel transit expert. Return transit options between two cities as a JSON array ONLY (no other text).\n" +
            "Format (English only):\n" +
            "[{\"type\":\"airplane|train|bus|ferry\",\"icon\":\"✈|🚄|🚌|🚢\",\"name\":\"route name\"," +
            "\"tag\":\"Recommended|Cheapest|Fastest|\",\"tagColor\":\"#1E2A3A|#f59e0b|#10b981|\"," +
            "\"time\":\"duration (e.g. 2h 30m)\",\"price\":\"estimated price range in KRW (e.g. '₩110,000 – ₩220,000')\",\"priceNum\":average number as integer," +
            "\"steps\":[\"step 1\",\"step 2\"]}]\n" +
            "Rules:\n" +
            "- Maximum 3 options.\n" +
            "- Always English text.\n" +
            "- Use estimated RANGES based on typical recent averages. Do NOT quote any real-time prices.\n" +
            "- Never mention or link to Skyscanner, Booking.com, Expedia, Kayak, Naver Flight, or any other booking brand.\n" +
            "- Never include 'links' field.\n" +
            "- Do not tell users to check external sites. Just provide the route and the price estimate.";

        String userMessage = "Transit options from " + from + " to " + to + ".";

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

        String cleaned = text.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
        // Safety scrub: strip any brand mentions that slipped through
        cleaned = scrubBrands(cleaned);
        return cleaned;
    }

    public String getTravelTip(String destination, String category) throws Exception {
        String apiKey = getApiKey();
        if (apiKey.isBlank()) return getFallbackTip(destination, category);

        String systemPrompt = "You are a travel expert. Return travel tips for a destination as JSON only.\n" +
            "Format (English only):\n" +
            "{\"destination\":\"city name\",\"tips\":[{\"icon\":\"💡\",\"title\":\"title\",\"content\":\"tip content\"}]," +
            "\"bestSeason\":\"best time to visit\",\"currency\":\"local currency\",\"language\":\"local language\",\"timezone\":\"local timezone\"}\n" +
            "Rules:\n" +
            "- Always English text.\n" +
            "- Never mention Skyscanner, Booking.com, or any specific booking brand.\n" +
            "- Provide 3-5 practical, actionable tips.";

        String cat = (category != null && !category.isBlank()) ? category : "general";
        String userMessage = "Travel tips for " + destination + " (" + cat + ").";

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

        String cleaned = text.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
        cleaned = scrubBrands(cleaned);
        return cleaned;
    }

    /**
     * Remove any booking-brand mentions from AI-returned JSON.
     * This is a safety net in case the model ignores the prompt instruction.
     */
    private String scrubBrands(String s) {
        if (s == null) return s;
        return s
            .replaceAll("(?i)스카이스캐너", "")
            .replaceAll("(?i)skyscanner", "")
            .replaceAll("(?i)네이버\\s*항공(권|)?", "")
            .replaceAll("(?i)naver\\s*flight", "")
            .replaceAll("(?i)booking\\.com", "")
            .replaceAll("(?i)expedia", "")
            .replaceAll("(?i)kayak", "")
            .replaceAll("(?i)agoda", "");
    }

    private String getFallbackTransportInfo(String from, String to) {
        // Generic English fallback — no external brand references
        return "[{\"type\":\"airplane\",\"icon\":\"✈\",\"name\":\"" + from + " → " + to + " flight\"," +
            "\"tag\":\"Recommended\",\"tagColor\":\"#1E2A3A\",\"time\":\"varies\"," +
            "\"price\":\"Estimate unavailable — please check your preferred booking service\",\"priceNum\":0," +
            "\"steps\":[\"Depart from " + from + "\",\"Board flight\",\"Arrive at " + to + "\"]}]";
    }

    private String getFallbackTip(String destination, String category) {
        return "{\"destination\":\"" + destination + "\",\"tips\":[" +
            "{\"icon\":\"💡\",\"title\":\"Local transit\",\"content\":\"Install local transit apps in advance\"}," +
            "{\"icon\":\"💰\",\"title\":\"Currency\",\"content\":\"Use airport or local ATMs for the best rates\"}," +
            "{\"icon\":\"🌐\",\"title\":\"Connectivity\",\"content\":\"Consider a pocket Wi-Fi device or local SIM card\"}]," +
            "\"bestSeason\":\"Spring, Fall\",\"currency\":\"local currency\",\"language\":\"Learn basic local phrases\",\"timezone\":\"Check local time\"}";
    }
}
