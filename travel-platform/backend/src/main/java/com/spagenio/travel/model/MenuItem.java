package com.spagenio.travel.model;

import jakarta.persistence.*;

@Entity
@Table(name = "menu_items")
public class MenuItem {
    @Id
    private String key; // feed, nearby, explore, write, planner, share, exchange, profile

    private String icon;
    private String label;
    private boolean visible = true;
    private int sortOrder = 0;
    private boolean requireLogin = false; // 로그인 필요 여부

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public boolean isRequireLogin() { return requireLogin; }
    public void setRequireLogin(boolean requireLogin) { this.requireLogin = requireLogin; }
}
