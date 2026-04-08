package com.spagenio.travel.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api")
public class UploadController {

    @Value("${upload.dir:${user.home}/projects/spagenio/travel-platform/uploads}")
    private String uploadDir;

    @Value("${upload.base-url:https://travel.spagenio.com}")
    private String baseUrl;

    private static final Set<String> ALLOWED_TYPES = Set.of(
        "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"
    );
    private static final long MAX_SIZE = 10 * 1024 * 1024; // 10MB

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        // 파일 검증
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "파일이 없습니다."));
        }
        if (!ALLOWED_TYPES.contains(file.getContentType())) {
            return ResponseEntity.badRequest().body(Map.of("error", "이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)"));
        }
        if (file.getSize() > MAX_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "파일 크기는 10MB 이하여야 합니다."));
        }

        try {
            // 날짜별 폴더 생성
            String dateDir = java.time.LocalDate.now().toString().replace("-", "/");
            Path dir = Paths.get(uploadDir, dateDir);
            Files.createDirectories(dir);

            // 고유 파일명 생성
            String ext = getExtension(file.getOriginalFilename());
            String filename = UUID.randomUUID().toString().replace("-", "") + ext;
            Path filePath = dir.resolve(filename);

            // 저장
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // URL 반환
            String url = baseUrl + "/uploads/" + dateDir + "/" + filename;
            return ResponseEntity.ok(Map.of("url", url, "filename", filename));

        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "파일 저장 중 오류가 발생했습니다."));
        }
    }

    // 여러 파일 한번에 업로드
    @PostMapping("/upload/multiple")
    public ResponseEntity<?> uploadMultiple(@RequestParam("files") MultipartFile[] files) {
        if (files.length > 10) {
            return ResponseEntity.badRequest().body(Map.of("error", "최대 10개까지 업로드 가능합니다."));
        }
        List<String> urls = new ArrayList<>();
        for (MultipartFile file : files) {
            ResponseEntity<?> result = upload(file);
            if (result.getStatusCode().is2xxSuccessful()) {
                Map<?, ?> body = (Map<?, ?>) result.getBody();
                urls.add((String) body.get("url"));
            }
        }
        return ResponseEntity.ok(Map.of("urls", urls));
    }

    private String getExtension(String filename) {
        if (filename == null) return ".jpg";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : ".jpg";
    }
}
