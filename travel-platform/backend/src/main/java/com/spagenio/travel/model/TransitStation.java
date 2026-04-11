package com.spagenio.travel.model;
import jakarta.persistence.*;

@Entity
@Table(name = "transit_stations")
public class TransitStation {
    @Id private String id;
    private String cityId;
    private String nameKo;
    private String nameEn;
    private Double x;
    private Double y;
    private Integer isTransfer;

    public String getId() { return id; }
    public String getCityId() { return cityId; }
    public String getNameKo() { return nameKo; }
    public String getNameEn() { return nameEn; }
    public Double getX() { return x; }
    public Double getY() { return y; }
    public Integer getIsTransfer() { return isTransfer; }
}
