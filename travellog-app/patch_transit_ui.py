#!/usr/bin/env python3
"""
TransitScreen.js 경로 결과 렌더링을 웹과 동일하게 수정

1. searchRoute 결과에 segments 추가 생성
2. 결과 렌더링을 세그먼트별로 (라인 색상 + 환승 표시)

사용: 
  cd ~/projects/spagenio/travellog-app
  python3 patch_transit_ui.py
"""
import shutil
from datetime import datetime

PATH = "src/screens/TransitScreen.js"

def backup():
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bp = f"{PATH}.bak-{ts}"
    shutil.copy(PATH, bp)
    print(f"📦 백업: {bp}")
    return bp

def patch():
    with open(PATH, encoding='utf-8') as f:
        content = f.read()

    # ============= 1. searchRoute 끝부분에 segments 생성 추가 =============
    old_set = """    setRouteResult({
      totalTime: distances[toStation.id],
      path,
      stationMap,
      lineMap,
      from: fromStation,
      to: toStation,
    });
    setSearching(false);
  };"""

    new_set = """    // 세그먼트 생성 (라인이 바뀌면 새 세그먼트)
    const segments = [];
    let curLineId = null;
    let curSegment = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (i === 0) {
        // 시작점 - 다음 연결의 lineId로 시작
        curLineId = path[1]?.lineId || null;
        curSegment = [p.stationId];
      } else {
        const lineId = p.lineId;
        if (lineId !== curLineId) {
          // 라인 변경 -> 세그먼트 분리
          if (curSegment.length > 0) {
            segments.push({ lineId: curLineId, stations: curSegment });
          }
          curLineId = lineId;
          curSegment = [path[i - 1].stationId, p.stationId];
        } else {
          curSegment.push(p.stationId);
        }
      }
    }
    if (curSegment.length > 0) segments.push({ lineId: curLineId, stations: curSegment });

    setRouteResult({
      totalTime: distances[toStation.id],
      path,
      segments,
      stationMap,
      lineMap,
      from: fromStation,
      to: toStation,
      transfers: Math.max(0, segments.length - 1),
    });
    setSearching(false);
  };"""

    if old_set in content:
        content = content.replace(old_set, new_set)
        print("✅ 1/3: segments 생성 로직 추가")
    else:
        print("❌ 1/3: searchRoute 끝부분 패턴 못 찾음")
        return False

    # ============= 2. 결과 렌더링을 세그먼트 기반으로 =============
    old_render = """              {routeResult && !routeResult.error && (
                <View style={S.resultWrap}>
                  <Text style={S.resultTime}>{routeResult.totalTime} MIN</Text>
                  <Text style={S.resultSub}>{routeResult.path.length - 1} STOPS</Text>
                  <View style={S.routeList}>
                    {routeResult.path.map((p, i) => {
                      const st = routeResult.stationMap[p.stationId];
                      const ln = p.lineId ? routeResult.lineMap[p.lineId] : null;
                      return (
                        <View key={p.stationId} style={S.routeStep}>
                          <View style={S.routeDot} />
                          <View style={{ flex: 1 }}>
                            <Text style={S.routeStation}>{st?.nameKo || st?.nameEn || p.stationId}</Text>
                            {ln && <Text style={S.routeLine}>{ln.nameKo || ln.nameEn}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}"""

    new_render = """              {routeResult && !routeResult.error && (
                <View style={S.resultWrap}>
                  {/* 요약 카드 */}
                  <View style={S.summaryCard}>
                    <View style={S.summaryItem}>
                      <Text style={S.summaryNum}>{routeResult.totalTime}min</Text>
                      <Text style={S.summaryLabel}>est. travel</Text>
                    </View>
                    <View style={S.summaryDivider} />
                    <View style={S.summaryItem}>
                      <Text style={S.summaryNum}>{routeResult.path.length - 1}</Text>
                      <Text style={S.summaryLabel}>stops</Text>
                    </View>
                    <View style={S.summaryDivider} />
                    <View style={S.summaryItem}>
                      <Text style={S.summaryNum}>{routeResult.transfers}</Text>
                      <Text style={S.summaryLabel}>transfer</Text>
                    </View>
                  </View>

                  <Text style={S.detailsLabel}>Details Route</Text>

                  {/* 세그먼트별 렌더링 */}
                  {(routeResult.segments || []).map((seg, si) => {
                    const line = routeResult.lineMap[seg.lineId];
                    const lineColor = line?.color || '#888';
                    const lineName = line?.nameKo || line?.nameEn || 'Line';
                    const nextSeg = routeResult.segments[si + 1];
                    const nextLine = nextSeg ? routeResult.lineMap[nextSeg.lineId] : null;
                    return (
                      <View key={si} style={{ marginBottom: 16 }}>
                        {/* 라인 헤더 */}
                        <View style={S.segHeader}>
                          <View style={[S.lineBadge, { backgroundColor: lineColor }]}>
                            <Text style={S.lineBadgeText}>{lineName}</Text>
                          </View>
                          <Text style={S.segStops}>{seg.stations.length - 1}stops</Text>
                        </View>
                        {/* 세그먼트 역들 (라인 색상 왼쪽 바) */}
                        <View style={[S.segBody, { borderLeftColor: lineColor }]}>
                          {seg.stations.map((sid, idx) => {
                            const st = routeResult.stationMap[sid];
                            if (!st) return null;
                            const isFirst = idx === 0;
                            const isLast = idx === seg.stations.length - 1;
                            const faded = !isFirst && !isLast && seg.stations.length > 3;
                            return (
                              <View key={sid} style={[S.segStation, faded && { opacity: 0.5 }]}>
                                <View style={[
                                  S.segDot,
                                  { borderColor: lineColor },
                                  (isFirst || isLast) && { backgroundColor: lineColor, width: 10, height: 10 }
                                ]} />
                                <Text style={[S.segStationName, (isFirst || isLast) && { fontWeight: '700' }]}>
                                  {st.nameKo || st.nameEn}
                                </Text>
                                {(isFirst || isLast) && st.nameEn && st.nameKo && (
                                  <Text style={S.segStationEn}>{st.nameEn}</Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                        {/* 환승 표시 */}
                        {nextLine && (
                          <View style={S.transferBar}>
                            <Text style={S.transferText}>
                              🔄 Transfer — {nextLine.nameKo || nextLine.nameEn} Board
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}"""

    if old_render in content:
        content = content.replace(old_render, new_render)
        print("✅ 2/3: 결과 렌더링을 세그먼트 기반으로 변경")
    else:
        print("❌ 2/3: 결과 렌더링 패턴 못 찾음")
        return False

    # ============= 3. 스타일 추가 =============
    # StyleSheet.create({ ... }) 안에 새 스타일 추가
    # resultTime 스타일 뒤에 추가
    style_marker = "  resultTime: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 36, color: colors.primary, letterSpacing: -1 },"

    new_styles = """  resultTime: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 36, color: colors.primary, letterSpacing: -1 },
  summaryCard: { flexDirection: 'row', backgroundColor: '#FAFAF8', borderRadius: 3, padding: 14, marginBottom: 18, gap: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.primary },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8A919C', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#F0EEE9' },
  detailsLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#4A5568', marginBottom: 12 },
  segHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lineBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3, marginRight: 8 },
  lineBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: 'white', letterSpacing: 0.5 },
  segStops: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8A919C' },
  segBody: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4, marginLeft: 8 },
  segStation: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  segDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', borderWidth: 2, marginLeft: -20 },
  segStationName: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.primary },
  segStationEn: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8A919C' },
  transferBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingLeft: 12 },
  transferText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#f59e0b' },"""

    if style_marker in content:
        content = content.replace(style_marker, new_styles)
        print("✅ 3/3: 새 스타일 추가")
    else:
        print("❌ 3/3: resultTime 스타일 못 찾음")
        return False

    with open(PATH, 'w', encoding='utf-8') as f:
        f.write(content)

    return True


if __name__ == "__main__":
    bp = backup()
    try:
        ok = patch()
        if ok:
            print("\n🎉 패치 완료!")
            print(f"   백업: {bp}")
            print("\n다음 단계:")
            print("   Expo Hot Reload 자동 반영됨")
            print("   방화 → 홍대입구 FIND ROUTE 테스트!")
        else:
            print("\n⚠️  일부 실패")
            print(f"   롤백: cp {bp} {PATH}")
    except Exception as e:
        print(f"\n❌ 에러: {e}")
        print(f"   롤백: cp {bp} {PATH}")
