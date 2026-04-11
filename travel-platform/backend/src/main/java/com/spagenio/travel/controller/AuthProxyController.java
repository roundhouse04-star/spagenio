package com.spagenio.travel.controller;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
public class AuthProxyController {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String PYTHON_BASE = "http://localhost:9001";

    // /api/auth/** → Python /api/**
    @RequestMapping("/api/auth/**")
    public ResponseEntity<String> proxyAuth(
            HttpServletRequest request,
            @RequestBody(required = false) String body) throws IOException {

        String path = request.getRequestURI().replaceFirst("/api/auth", "/api");
        String query = request.getQueryString();
        String url = PYTHON_BASE + path + (query != null ? "?" + query : "");

        return forward(request, body, url);
    }

    // /api/admin/** → Python /api/admin/**
    @RequestMapping("/api/admin/**")
    public ResponseEntity<String> proxyAdmin(
            HttpServletRequest request,
            @RequestBody(required = false) String body) throws IOException {

        String path = request.getRequestURI();
        String query = request.getQueryString();
        String url = PYTHON_BASE + path + (query != null ? "?" + query : "");

        return forward(request, body, url);
    }

    private ResponseEntity<String> forward(HttpServletRequest request, String body, String url) {
        HttpMethod method = HttpMethod.valueOf(request.getMethod());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String auth = request.getHeader("Authorization");
        if (auth != null) headers.set("Authorization", auth);

        HttpEntity<String> entity = new HttpEntity<>(body, headers);

        try {
            return restTemplate.exchange(url, method, entity, String.class);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"error\":\"Python 서비스 연결 오류\"}");
        }
    }
}
