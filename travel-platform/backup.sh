#!/bin/bash
# 로컬 백업
LOCAL_DIR=~/backups/travellog
# iCloud 백업
ICLOUD_DIR=~/Library/Mobile\ Documents/com~apple~CloudDocs/Backups/travellog
DB_PATH=~/projects/spagenio/travel-platform/data/travellog.db
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$LOCAL_DIR"
mkdir -p "$ICLOUD_DIR"

# 안전하게 백업
sqlite3 "$DB_PATH" ".backup $LOCAL_DIR/travellog_$DATE.db"

# iCloud에도 복사
cp "$LOCAL_DIR/travellog_$DATE.db" "$ICLOUD_DIR/travellog_$DATE.db"

# 30일 이상 된 백업 삭제
find "$LOCAL_DIR" -name "*.db" -mtime +30 -delete
find "$ICLOUD_DIR" -name "*.db" -mtime +30 -delete

echo "✅ 백업 완료: travellog_$DATE.db"
echo "📁 로컬: $LOCAL_DIR"
echo "☁️  iCloud: Backups/travellog"
echo "📊 파일 수: $(ls "$LOCAL_DIR"/*.db 2>/dev/null | wc -l)"
