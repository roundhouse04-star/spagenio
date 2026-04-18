#!/usr/bin/env bash
#
# spagenio 교통 DB 데이터를 my-trip-log 앱용 JSON으로 export
#
# 사용:
#   bash export-transit-data.sh
#
# 출력: my-trip-log/src/data/transit.json
#

set -e

DB="/Users/roundhouse04/projects/spagenio/travel-platform/data/travellog.db"
OUTPUT_DIR="/Users/roundhouse04/projects/spagenio/my-trip-log/src/data"
OUTPUT="$OUTPUT_DIR/transit.json"

mkdir -p "$OUTPUT_DIR"

if [ ! -f "$DB" ]; then
  echo "❌ DB 파일 없음: $DB"
  exit 1
fi

# 어떤 테이블이 있는지 확인
echo "🔍 교통 관련 테이블 검색 중..."
TABLES=$(sqlite3 "$DB" ".tables" | tr -s ' \t' '\n' | grep -iE 'transit|station|line|route' || true)

if [ -z "$TABLES" ]; then
  echo "⚠️  교통 테이블 없음. 빈 JSON 생성"
  echo '{"cities":[],"lines":[],"stations":[],"connections":[]}' > "$OUTPUT"
  echo "✅ 빈 데이터 생성: $OUTPUT"
  exit 0
fi

echo "📋 발견된 테이블:"
echo "$TABLES"
echo ""

# JSON 빌드 (jq 사용)
if ! command -v jq &> /dev/null; then
  echo "❌ jq가 필요합니다. brew install jq 실행 후 다시 시도하세요"
  exit 1
fi

# 각 테이블을 JSON 배열로
LINES_JSON='[]'
STATIONS_JSON='[]'
CONNECTIONS_JSON='[]'

if echo "$TABLES" | grep -qi "transit_lines\|^lines"; then
  TABLE=$(echo "$TABLES" | grep -iE "transit_lines|^lines" | head -1)
  LINES_JSON=$(sqlite3 -json "$DB" "SELECT * FROM $TABLE;" 2>/dev/null || echo '[]')
  echo "✅ Lines: $(echo "$LINES_JSON" | jq 'length')개"
fi

if echo "$TABLES" | grep -qi "transit_stations\|^stations"; then
  TABLE=$(echo "$TABLES" | grep -iE "transit_stations|^stations" | head -1)
  STATIONS_JSON=$(sqlite3 -json "$DB" "SELECT * FROM $TABLE;" 2>/dev/null || echo '[]')
  echo "✅ Stations: $(echo "$STATIONS_JSON" | jq 'length')개"
fi

if echo "$TABLES" | grep -qi "transit_connections\|^connections"; then
  TABLE=$(echo "$TABLES" | grep -iE "transit_connections|^connections" | head -1)
  CONNECTIONS_JSON=$(sqlite3 -json "$DB" "SELECT * FROM $TABLE;" 2>/dev/null || echo '[]')
  echo "✅ Connections: $(echo "$CONNECTIONS_JSON" | jq 'length')개"
fi

# 도시 목록 추출 (lines.city 또는 stations.city에서)
CITIES_JSON=$(echo "$LINES_JSON" | jq '[.[] | .city] | unique | map(select(. != null))' 2>/dev/null || echo '[]')

# 최종 JSON 합치기
jq -n \
  --argjson cities "$CITIES_JSON" \
  --argjson lines "$LINES_JSON" \
  --argjson stations "$STATIONS_JSON" \
  --argjson connections "$CONNECTIONS_JSON" \
  '{
    exportedAt: now | todate,
    cities: $cities,
    lines: $lines,
    stations: $stations,
    connections: $connections
  }' > "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "✅ Export 완료!"
echo "   파일: $OUTPUT"
echo "   크기: $SIZE"
echo ""
echo "다음 단계:"
echo "   cd ~/projects/spagenio"
echo "   git add my-trip-log/src/data/"
echo "   git commit -m 'data: 교통 데이터 마이그레이션'"
echo "   git push"
