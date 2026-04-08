package com.spagenio.travel.model;
import java.util.ArrayList;
import java.util.List;
public class Plan {
    private String id;
    private String userId;
    private String title;
    private String startDate;
    private String endDate;
    private List<PlanItem> items = new ArrayList<>();
    private String createdAt;
    private String updatedAt;
    public Plan() {}
    public String getId() { return id; } public void setId(String v) { this.id = v; }
    public String getUserId() { return userId; } public void setUserId(String v) { this.userId = v; }
    public String getTitle() { return title; } public void setTitle(String v) { this.title = v; }
    public String getStartDate() { return startDate; } public void setStartDate(String v) { this.startDate = v; }
    public String getEndDate() { return endDate; } public void setEndDate(String v) { this.endDate = v; }
    public List<PlanItem> getItems() { return items; } public void setItems(List<PlanItem> v) { this.items = v; }
    public String getCreatedAt() { return createdAt; } public void setCreatedAt(String v) { this.createdAt = v; }
    public String getUpdatedAt() { return updatedAt; } public void setUpdatedAt(String v) { this.updatedAt = v; }
}
