package com.spagenio.travel.model;

import jakarta.persistence.*;

@Entity
@Table(name = "promotions")
public class Promotion {
    @Id private String id;
    private String title;
    @Column(columnDefinition = "TEXT")
    private String content;
    private String imageUrl = "";
    private String linkUrl = "";
    private String linkLabel = "자세히 보기";
    private String type = "notice"; // notice | ad | event
    private boolean active = true;
    private int insertEvery = 5; // 몇 개마다 삽입할지 (3/5/10)
    private int priority = 0;
    private String createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public String getLinkUrl() { return linkUrl; }
    public void setLinkUrl(String linkUrl) { this.linkUrl = linkUrl; }
    public String getLinkLabel() { return linkLabel; }
    public void setLinkLabel(String linkLabel) { this.linkLabel = linkLabel; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public int getInsertEvery() { return insertEvery; }
    public void setInsertEvery(int insertEvery) { this.insertEvery = insertEvery; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
