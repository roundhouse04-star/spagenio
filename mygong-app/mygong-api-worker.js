// ============================================================
//  mygong-api — Cloudflare Worker
//  KOPIS + 한눈에보는문화정보 API 통합 프록시
// 
//  배포 위치: https://mygong-api.roundhouse04.workers.dev
//  Secrets  : 
//    - KOPIS_API_KEY (기존)
//    - CULTURE_API_KEY (신규)
//
//  v1.2 업데이트: 한눈에보는문화정보 API 추가
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ─── 헬스체크 ────────────────────────────────────────────
    if (path === "/" || path === "/health") {
      return json(
        {
          status: "ok",
          service: "mygong-api",
          version: "1.2",
          apis: ["KOPIS", "한눈에보는문화정보"],
          endpoints: [
            "/performances?stdate=&eddate=&shprfnm=",
            "/performance/:mt20id",
          ],
        },
        corsHeaders
      );
    }

    // ─── 공연 목록 (통합) ────────────────────────────────────
    // KOPIS + 한눈에보는문화정보 동시 조회 후 병합
    if (path === "/performances") {
      return fetchCombinedPerformances(url.searchParams, env, corsHeaders);
    }

    // ─── 공연 상세 (KOPIS만) ─────────────────────────────────
    if (path.startsWith("/performance/")) {
      const mt20id = path.slice("/performance/".length);
      if (!mt20id) {
        return json({ error: "missing mt20id" }, corsHeaders, 400);
      }
      return proxyKopis(
        `https://www.kopis.or.kr/openApi/restful/pblprfr/${encodeURIComponent(mt20id)}`,
        url.searchParams,
        env,
        corsHeaders
      );
    }

    return json({ error: "Not found", path }, corsHeaders, 404);
  },
};

// ─── 통합 검색 ─────────────────────────────────────────────
async function fetchCombinedPerformances(clientParams, env, corsHeaders) {
  if (!env.KOPIS_API_KEY) {
    return json(
      { error: "KOPIS_API_KEY not configured" },
      corsHeaders,
      500
    );
  }

  // 1. KOPIS 검색
  const kopisXml = await fetchKopisPerformances(clientParams, env);

  // 2. 한눈에보는문화정보 검색 (선택적)
  let cultureXml = "";
  if (env.CULTURE_API_KEY) {
    try {
      cultureXml = await fetchCulturePerformances(clientParams, env);
    } catch (e) {
      console.warn("[culture-api] 검색 실패:", e.message);
    }
  }

  // 3. XML 병합
  const merged = mergeXmlResults(kopisXml, cultureXml);

  return new Response(merged, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

// ─── KOPIS 검색 ────────────────────────────────────────────
async function fetchKopisPerformances(clientParams, env) {
  const params = new URLSearchParams();
  for (const [k, v] of clientParams) {
    if (k === "service") continue;
    params.set(k, v);
  }
  params.set("service", env.KOPIS_API_KEY);

  if (!params.has("rows")) params.set("rows", "100");
  if (!params.has("cpage")) params.set("cpage", "1");

  const url = `https://www.kopis.or.kr/openApi/restful/pblprfr?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });
  
  return await response.text();
}

// ─── 한눈에보는문화정보 검색 ───────────────────────────────
async function fetchCulturePerformances(clientParams, env) {
  const shprfnm = clientParams.get("shprfnm") || "";
  const stdate = clientParams.get("stdate") || "";
  const eddate = clientParams.get("eddate") || "";

  if (!shprfnm) {
    return ""; // 검색어 없으면 스킵
  }

  // 한눈에보는문화정보 API 파라미터
  const params = new URLSearchParams();
  params.set("serviceKey", env.CULTURE_API_KEY);
  params.set("keyword", shprfnm);  // 공연명으로 검색
  
  if (stdate) params.set("from", stdate);
  if (eddate) params.set("to", eddate);
  
  params.set("cPage", "1");
  params.set("rows", "100");
  params.set("sortStdr", "1");  // 정렬 기준

  // 한눈에보는문화정보 API - 기간별 검색
  const url = `http://apis.data.go.kr/B553457/cultureinfo/period2?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });

  if (!response.ok) {
    throw new Error(`Culture API error: ${response.status}`);
  }
  
  return await response.text();
}

// ─── XML 병합 ──────────────────────────────────────────────
function mergeXmlResults(kopisXml, cultureXml) {
  // KOPIS XML에서 <db> 태그 추출
  const kopisMatches = kopisXml.match(/<db>[\s\S]*?<\/db>/g) || [];
  
  // 한눈에보는문화정보 XML에서 항목 추출 후 KOPIS 형식으로 변환
  let cultureItems = [];
  if (cultureXml) {
    const cultureMatches = cultureXml.match(/<item>[\s\S]*?<\/item>/g) || [];
    cultureItems = cultureMatches.map(convertCultureToKopis).filter(Boolean);
  }

  // 중복 제거 (공연명 기준)
  const seen = new Set();
  const dedupedItems = [];

  for (const item of [...kopisMatches, ...cultureItems]) {
    const titleMatch = item.match(/<prfnm>(.*?)<\/prfnm>/);
    const title = titleMatch ? titleMatch[1] : "";
    
    if (title && !seen.has(title)) {
      seen.add(title);
      dedupedItems.push(item);
    }
  }

  // 전체 XML 재구성
  const totalCount = dedupedItems.length;
  const itemsXml = dedupedItems.join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<dbs>
  <db>
    <comMsgHeader>
      <msgId></msgId>
      <returnCode>00</returnCode>
    </comMsgHeader>
    <msgBody>
      <totalCount>${totalCount}</totalCount>
      ${itemsXml}
    </msgBody>
  </db>
</dbs>`;
}

// ─── 한눈에보는문화정보 → KOPIS 형식 변환 ────────────────
function convertCultureToKopis(cultureXml) {
  try {
    // seq 추출 (external ID로 사용)
    const seqMatch = cultureXml.match(/<seq>(.*?)<\/seq>/);
    const seq = seqMatch ? seqMatch[1] : "";
    
    if (!seq) return null;

    // 필드 추출
    const title = extractField(cultureXml, "title") || "";
    const place = extractField(cultureXml, "place") || "";
    const startDate = extractField(cultureXml, "startDate") || "";
    const endDate = extractField(cultureXml, "endDate") || "";
    const thumbnail = extractField(cultureXml, "thumbnail") || "";
    const realmName = extractField(cultureXml, "realmName") || "";
    const area = extractField(cultureXml, "area") || "";

    // KOPIS 형식으로 변환
    return `<db>
      <mt20id>CULTURE_${seq}</mt20id>
      <prfnm>${escapeXml(title)}</prfnm>
      <prfpdfrom>${startDate}</prfpdfrom>
      <prfpdto>${endDate}</prfpdto>
      <fcltynm>${escapeXml(place)}</fcltynm>
      <poster>${escapeXml(thumbnail)}</poster>
      <area>${escapeXml(area)}</area>
      <genrenm>${escapeXml(realmName)}</genrenm>
      <prfstate>공연중</prfstate>
    </db>`;
  } catch (e) {
    console.warn("[convert] 변환 실패:", e.message);
    return null;
  }
}

// ─── 헬퍼 함수 ─────────────────────────────────────────────
function extractField(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's'));
  return match ? match[1].trim() : "";
}

function escapeXml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── KOPIS 프록시 (상세 조회용) ────────────────────────────
async function proxyKopis(baseUrl, clientParams, env, corsHeaders) {
  if (!env.KOPIS_API_KEY) {
    return json(
      { error: "KOPIS_API_KEY not configured" },
      corsHeaders,
      500
    );
  }

  const params = new URLSearchParams();
  for (const [k, v] of clientParams) {
    if (k === "service") continue;
    params.set(k, v);
  }
  params.set("service", env.KOPIS_API_KEY);

  const kopisUrl = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(kopisUrl, {
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    return json({ error: error.message }, corsHeaders, 502);
  }
}

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
