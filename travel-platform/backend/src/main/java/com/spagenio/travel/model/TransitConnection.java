package com.spagenio.travel.model;
import jakarta.persistence.*;

@Entity
@Table(name = "transit_connections")
public class TransitConnection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String fromStationId;
    private String toStationId;
    private String lineId;
    private Integer travelTime;
    private Integer isTransfer;

    public Long getId() { return id; }
    public String getFromStationId() { return fromStationId; }
    public String getToStationId() { return toStationId; }
    public String getLineId() { return lineId; }
    public Integer getTravelTime() { return travelTime; }
    public Integer getIsTransfer() { return isTransfer; }
}
