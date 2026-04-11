package com.spagenio.travel.model;
import jakarta.persistence.*;

@Entity
@Table(name = "transit_lines")
public class TransitLine {
    @Id private String id;
    private String cityId;
    private String nameKo;
    private String nameEn;
    private String color;
    private String textColor;
    private Integer lineOrder;

    public String getId() { return id; }
    public String getCityId() { return cityId; }
    public String getNameKo() { return nameKo; }
    public String getNameEn() { return nameEn; }
    public String getColor() { return color; }
    public String getTextColor() { return textColor; }
    public Integer getLineOrder() { return lineOrder; }
}
