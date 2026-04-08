package com.example.demo.repository;

import com.example.demo.model.Booking;
import com.example.demo.model.ItineraryItem;
import com.example.demo.model.TravelDatabase;
import com.example.demo.model.TravelPackage;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class TravelRepository {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path storagePath = Paths.get("data", "travel-db.json");
    private TravelDatabase database;

    @PostConstruct
    public synchronized void init() {
        try {
            Files.createDirectories(storagePath.getParent());
            if (Files.exists(storagePath)) {
                database = objectMapper.readValue(storagePath.toFile(), TravelDatabase.class);
            } else {
                database = createSeedDatabase();
                persist();
            }
        } catch (IOException exception) {
            throw new RuntimeException("travel database init failed", exception);
        }
    }

    public synchronized List<TravelPackage> searchPackages(String destination, String budget, String category, Integer travelers) {
        return database.getPackages().stream()
                .filter(pkg -> isBlank(destination) || containsIgnoreCase(pkg.getDestination(), destination) || containsIgnoreCase(pkg.getLocation(), destination) || containsIgnoreCase(pkg.getTitle(), destination))
                .filter(pkg -> isBlank(budget) || budget.equalsIgnoreCase(pkg.getBudget()))
                .filter(pkg -> isBlank(category) || category.equalsIgnoreCase(pkg.getCategory()))
                .filter(pkg -> travelers == null || travelers >= pkg.getMinimumTravelers())
                .sorted(Comparator.comparing(TravelPackage::getRating).reversed()
                        .thenComparing(TravelPackage::getPricePerPerson))
                .collect(Collectors.toList());
    }

    public synchronized List<TravelPackage> featuredPackages() {
        return database.getPackages().stream().filter(TravelPackage::isFeatured).collect(Collectors.toList());
    }

    public synchronized Optional<TravelPackage> findPackageById(Long id) {
        return database.getPackages().stream().filter(pkg -> pkg.getId().equals(id)).findFirst();
    }

    public synchronized List<Booking> findBookings() {
        return database.getBookings().stream()
                .sorted(Comparator.comparing(Booking::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public synchronized Booking saveBooking(Booking booking) {
        long nextId = database.getBookings().stream().mapToLong(existing -> existing.getId() == null ? 0 : existing.getId()).max().orElse(0) + 1;
        booking.setId(nextId);
        booking.setBookingCode("TRV-" + String.format(Locale.ROOT, "%05d", nextId));
        booking.setStatus("CONFIRMED");
        booking.setCreatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        database.getBookings().add(booking);
        persist();
        return booking;
    }

    public synchronized Optional<Booking> findBookingById(Long id) {
        return database.getBookings().stream().filter(b -> b.getId().equals(id)).findFirst();
    }

    public synchronized Booking cancelBooking(Long id) {
        Booking booking = database.getBookings().stream().filter(b -> b.getId().equals(id)).findFirst()
                .orElseThrow(() -> new RuntimeException("booking_not_found"));
        booking.setStatus("CANCELLED");
        persist();
        return booking;
    }

    private void persist() {
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(storagePath.toFile(), database);
        } catch (IOException exception) {
            throw new RuntimeException("travel database persist failed", exception);
        }
    }

    private TravelDatabase createSeedDatabase() {
        TravelDatabase seed = new TravelDatabase();
        seed.setPackages(new ArrayList<>(List.of(
                packageOf(1L, "오사카 벚꽃 시티 브레이크", "Osaka", "Japan / Osaka", "도심 관광과 미식 탐방에 최적화된 대표 도시형 패키지", "city", "도시", "economy", 3, 2, 429000, 4.8, 1,
                        List.of("왕복 항공 포함", "난바 중심 호텔", "유니버설/도톤보리 옵션"),
                        List.of("왕복 항공권", "2박 호텔", "공항-호텔 픽업", "1일 자유여행 가이드"),
                        List.of("개인 경비", "여행자 보험"),
                        List.of(new ItineraryItem(1, "출국 및 체크인", "인천 출발 후 오사카 도착, 호텔 체크인 및 도톤보리 자유 일정"), new ItineraryItem(2, "도심 핵심 투어", "오사카성, 우메다, 쇼핑 자유 일정"), new ItineraryItem(3, "귀국", "체크아웃 후 공항 이동 및 귀국")),
                        true),
                packageOf(2L, "도쿄 프리미엄 아트 & 시티", "Tokyo", "Japan / Tokyo", "럭셔리 시티호퍼를 위한 호텔 업그레이드형 상품", "city", "도시", "premium", 4, 3, 890000, 4.9, 1,
                        List.of("긴자 5성급", "미술관 패스", "전용 차량 옵션"),
                        List.of("왕복 항공권", "3박 호텔", "도쿄 메트로 패스", "아트 뮤지엄 패스"),
                        List.of("개인 쇼핑", "추가 식사"),
                        List.of(new ItineraryItem(1, "도쿄 도착", "긴자 호텔 체크인 후 주변 산책"), new ItineraryItem(2, "아트 투어", "모리 미술관과 팀랩 플래닛 방문"), new ItineraryItem(3, "도심 자유 일정", "시부야, 하라주쿠, 오모테산도 일정"), new ItineraryItem(4, "귀국", "체크아웃 후 공항 이동")),
                        true),
                packageOf(3L, "발리 풀빌라 허니문", "Bali", "Indonesia / Bali", "프라이빗 풀빌라와 스파가 포함된 허니문 베스트셀러", "honeymoon", "허니문", "luxury", 5, 4, 1550000, 4.95, 2,
                        List.of("풀빌라 2박", "커플 스파", "선셋 디너"),
                        List.of("왕복 항공권", "리조트 4박", "공항 왕복 픽업", "스파 1회", "선셋 디너"),
                        List.of("개인 액티비티", "자유일정 식사"),
                        List.of(new ItineraryItem(1, "발리 도착", "리조트 체크인 및 휴식"), new ItineraryItem(2, "스파 & 디너", "커플 스파 후 선셋 디너"), new ItineraryItem(3, "비치 클럽", "전일 자유 일정 및 비치 클럽 이용"), new ItineraryItem(4, "우붓 투어", "우붓 투어 및 카페 투어"), new ItineraryItem(5, "귀국", "체크아웃 및 공항 이동")),
                        true),
                packageOf(4L, "다낭 패밀리 리조트", "Da Nang", "Vietnam / Da Nang", "가족여행 고객을 위한 리조트/키즈클럽 패키지", "family", "가족여행", "premium", 4, 3, 670000, 4.7, 3,
                        List.of("키즈클럽", "워터파크", "공항 픽업"),
                        List.of("왕복 항공권", "3박 리조트", "조식", "키즈클럽 1일권"),
                        List.of("개인 경비", "선택 관광"),
                        List.of(new ItineraryItem(1, "다낭 도착", "리조트 체크인 및 휴식"), new ItineraryItem(2, "리조트 데이", "키즈클럽과 수영장 이용"), new ItineraryItem(3, "호이안 반일 투어", "가이드와 함께 호이안 방문"), new ItineraryItem(4, "귀국", "체크아웃 및 귀국")),
                        false),
                packageOf(5L, "세부 오션 액티비티 스테이", "Cebu", "Philippines / Cebu", "스노클링과 리조트 휴양을 모두 잡은 인기 상품", "resort", "리조트", "economy", 4, 3, 590000, 4.65, 2,
                        List.of("호핑투어", "오션뷰 객실", "공항 픽업"),
                        List.of("왕복 항공권", "3박 리조트", "호핑투어", "조식"),
                        List.of("개인 장비", "추가 해양 액티비티"),
                        List.of(new ItineraryItem(1, "세부 도착", "리조트 체크인"), new ItineraryItem(2, "호핑투어", "섬 투어 및 스노클링"), new ItineraryItem(3, "자유 일정", "리조트 스파 또는 자유 일정"), new ItineraryItem(4, "귀국", "체크아웃 후 공항 이동")),
                        false),
                packageOf(6L, "싱가포르 스마트 시티 쇼트트립", "Singapore", "Singapore", "짧은 일정으로 핵심만 즐기는 도시형 패키지", "city", "도시", "premium", 3, 2, 780000, 4.75, 1,
                        List.of("마리나베이 관광", "유니버설 옵션", "교통패스"),
                        List.of("왕복 항공권", "2박 호텔", "교통패스"),
                        List.of("개인 식사", "선택 투어"),
                        List.of(new ItineraryItem(1, "싱가포르 도착", "마리나베이 산책 및 야경"), new ItineraryItem(2, "도심 투어", "가든스바이더베이, 오차드 일정"), new ItineraryItem(3, "귀국", "체크아웃 및 공항 이동")),
                        false)
        )));

        Booking booking = new Booking();
        booking.setId(1L);
        booking.setBookingCode("TRV-00001");
        booking.setPackageId(1L);
        booking.setPackageTitle("오사카 벚꽃 시티 브레이크");
        booking.setCustomerName("김민준");
        booking.setEmail("demo@spagenio.com");
        booking.setPhone("010-1234-5678");
        booking.setTravelers(2);
        booking.setTravelDate("2026-04-10");
        booking.setRequests("공항 픽업 우선 요청");
        booking.setTotalPrice(858000);
        booking.setStatus("CONFIRMED");
        booking.setCreatedAt(LocalDateTime.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        seed.setBookings(new ArrayList<>(List.of(booking)));
        return seed;
    }

    private TravelPackage packageOf(Long id, String title, String location, String destination, String summary, String category,
                                    String categoryLabel, String budget, int durationDays, int durationNights, int pricePerPerson,
                                    double rating, int minimumTravelers, List<String> highlights, List<String> inclusions,
                                    List<String> exclusions, List<ItineraryItem> itinerary, boolean featured) {
        TravelPackage pkg = new TravelPackage();
        pkg.setId(id);
        pkg.setTitle(title);
        pkg.setLocation(location);
        pkg.setDestination(destination);
        pkg.setSummary(summary);
        pkg.setCategory(category);
        pkg.setCategoryLabel(categoryLabel);
        pkg.setBudget(budget);
        pkg.setDurationDays(durationDays);
        pkg.setDurationNights(durationNights);
        pkg.setPricePerPerson(pricePerPerson);
        pkg.setRating(rating);
        pkg.setMinimumTravelers(minimumTravelers);
        pkg.setHighlights(highlights);
        pkg.setInclusions(inclusions);
        pkg.setExclusions(exclusions);
        pkg.setItinerary(itinerary);
        pkg.setFeatured(featured);
        return pkg;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean containsIgnoreCase(String source, String target) {
        return source != null && target != null && source.toLowerCase(Locale.ROOT).contains(target.toLowerCase(Locale.ROOT));
    }
}
