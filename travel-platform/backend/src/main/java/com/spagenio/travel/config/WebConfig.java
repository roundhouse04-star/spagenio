package com.spagenio.travel.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:4173", "https://travel.spagenio.com", "http://travel.spagenio.com")
                .allowedMethods("GET", "POST", "PATCH", "DELETE", "OPTIONS");
    }
}
