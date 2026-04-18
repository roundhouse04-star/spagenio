#!/usr/bin/env bash
#
# spagenio 교통 DB → my-trip-log JSON 변환
#
# 정확한 컬럼 매핑:
#   transit_cities      → cities[]
#   transit_lines       → lines[]
#   transit_stations    → stations[]
#   transit_station_lines → stationLines[] (역-노선 매핑)
#   transit_connections → connections[]
#
# 큰 데이터셋도 처리 가능 (임시 파일 사용)

set -e

DB="/Users/roundhouse04/projects/spagenio/travel-platform/data/travellog.db"
OUTPUT_DIR="/Users/roundhouse04/projects/spagenio/my-trip-log/src/data"
OUTPUT="$OUTPUT_DIR/transit.json"

mkdir -p "$OUTPUT_DIR"

if [ ! -f "$DB" ]; then
  echo "❌ DB 파일 없음: $DB"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "❌ jq가 필요합니다: brew install jq"
  exit 1
fi

# 임시 파일들
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "📥 spagenio 교통 데이터 export 중..."
echo "   임시 폴더: $TMPDIR"
echo ""

# 각 테이블을 임시 JSON 파일로 추출
sqlite3 -json "$DB" "SELECT id, name_ko AS nameKo, name_en AS nameEn, country, timezone FROM transit_cities ORDER BY name_ko;" > "$TMPDIR/cities.json" 2>/dev/null || echo "[]" > "$TMPDIR/cities.json"

sqlite3 -json "$DB" "SELECT id, city_id AS cityId, name_ko AS nameKo, name_en AS nameEn, color, text_color AS textColor, line_order AS lineOrder FROM transit_lines ORDER BY city_id, line_order;" > "$TMPDIR/lines.json" 2>/dev/null || echo "[]" > "$TMPDIR/lines.json"

sqlite3 -json "$DB" "SELECT id, city_id AS cityId, name_ko AS nameKo, name_en AS nameEn, x, y, is_transfer AS isTransfer FROM transit_stations ORDER BY city_id, name_ko;" > "$TMPDIR/stations.json" 2>/dev/null || echo "[]" > "$TMPDIR/stations.json"

sqlite3 -json "$DB" "SELECT station_id AS stationId, line_id AS lineId, station_order AS stationOrder FROM transit_station_lines ORDER BY line_id, station_order;" > "$TMPDIR/stationLines.json" 2>/dev/null || echo "[]" > "$TMPDIR/stationLines.json"

sqlite3 -json "$DB" "SELECT id, from_station_id AS fromStationId, to_station_id AS toStationId, line_id AS lineId, travel_time AS travelTime, is_transfer AS isTransfer FROM transit_connections;" > "$TMPDIR/connections.json" 2>/dev/null || echo "[]" > "$TMPDIR/connections.json"

# 빈 파일 → '[]'로 보정
for f in cities lines stations stationLines connections; do
  if [ ! -s "$TMPDIR/$f.json" ]; then
    echo "[]" > "$TMPDIR/$f.json"
  fi
done

# 카운트 출력
echo "🏙️  Cities:        $(jq 'length' "$TMPDIR/cities.json")개"
echo "🚇 Lines:         $(jq 'length' "$TMPDIR/lines.json")개"
echo "📍 Stations:      $(jq 'length' "$TMPDIR/stations.json")개"
echo "🔗 StationLines:  $(jq 'length' "$TMPDIR/stationLines.json")개"
echo "↔️  Connections:   $(jq 'length' "$TMPDIR/connections.json")개"
echo ""

# 임시 파일을 --slurpfile로 읽어서 합치기 (메모리/argv 제한 안 걸림)
jq -n \
  --slurpfile cities "$TMPDIR/cities.json" \
  --slurpfile lines "$TMPDIR/lines.json" \
  --slurpfile stations "$TMPDIR/stations.json" \
  --slurpfile stationLines "$TMPDIR/stationLines.json" \
  --slurpfile connections "$TMPDIR/connections.json" \
  '{
    exportedAt: now | todate,
    source: "spagenio travel-platform",
    cities: $cities[0],
    lines: $lines[0],
    stations: $stations[0],
    stationLines: $stationLines[0],
    connections: $connections[0]
  }' > "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "✅ Export 완료!"
echo "   파일: $OUTPUT"
echo "   크기: $SIZE"
echo ""
echo "다음 단계:"
echo "   cd ~/projects/spagenio"
echo "   git add my-trip-log/src/data/transit.json"
echo "   git commit -m 'data: 교통 데이터 마이그레이션 ($SIZE)'"
echo "   git push"
