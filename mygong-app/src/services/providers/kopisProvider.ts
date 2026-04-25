// ============================================================
// kopisProvider.ts - 한방에 XML 가져오기
// 로컬에서 파싱 최적화
// ============================================================

import { MYGONG_API_BASE, MYGONG_API_KOPIS_LIST, MYGONG_API_KOPIS_DETAIL } from '../../config/api';
import { splitByMonth } from './kopisCodes';

const MAX_CONCURRENCY = 4;

export interface KopisSearchParams {
  artistName: string;
  stdate: string;
  eddate: string;
  shcate?: string;
  afterdate?: string;
}

/**
 * 🆕 한방에 모든 XML 데이터 가져오기
 * 로컬에서 파싱하도록 raw XML 반환
 */
export async function fetchAllRawXML(params: KopisSearchParams): Promise<string[]> {
  const { artistName, stdate, eddate, shcate, afterdate } = params;
  
  // 날짜 범위를 31일 단위로 분할
  const dateChunks = splitByMonth(stdate, eddate);
  
  console.log(`[KOPIS] XML 수집 시작: ${artistName}`);
  console.log(`[KOPIS] 날짜: ${stdate} ~ ${eddate} (${dateChunks.length}개 청크)`);
  if (afterdate) {
    console.log(`[KOPIS] ⚡ afterdate: ${afterdate} 이후 수정분만`);
  }
  
  const allXmlChunks: string[] = [];
  
  // 청크를 MAX_CONCURRENCY 크기로 배치 처리
  for (let i = 0; i < dateChunks.length; i += MAX_CONCURRENCY) {
    const batch = dateChunks.slice(i, i + MAX_CONCURRENCY);
    
    const batchPromises = batch.map(chunk => 
      fetchChunkRawXML({
        artistName,
        stdate: chunk.stdate,
        eddate: chunk.eddate,
        shcate,
        afterdate
      })
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    // XML 청크 수집
    for (const xml of batchResults) {
      if (xml) {
        allXmlChunks.push(xml);
      }
    }
    
    console.log(`[KOPIS] 진행: ${Math.min(i + MAX_CONCURRENCY, dateChunks.length)}/${dateChunks.length} 청크 완료`);
  }
  
  console.log(`[KOPIS] XML 수집 완료: ${allXmlChunks.length}개 청크`);
  return allXmlChunks;
}

/**
 * 단일 청크의 raw XML 가져오기
 */
async function fetchChunkRawXML(params: {
  artistName: string;
  stdate: string;
  eddate: string;
  shcate?: string;
  afterdate?: string;
}): Promise<string | null> {
  const { artistName, stdate, eddate, shcate, afterdate } = params;
  
  const url = new URL(MYGONG_API_KOPIS_LIST, MYGONG_API_BASE);
  url.searchParams.set('stdate', stdate);
  url.searchParams.set('eddate', eddate);
  url.searchParams.set('shprfnm', artistName);
  url.searchParams.set('rows', '100');
  url.searchParams.set('cpage', '1');
  
  if (shcate) {
    url.searchParams.set('shcate', shcate);
  }
  
  if (afterdate) {
    url.searchParams.set('afterdate', afterdate);
  }
  
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/xml' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.text();
    
  } catch (error) {
    // console.error(`[KOPIS] 청크 조회 실패 (${stdate}~${eddate}):`, error);
    return null;
  }
}

/**
 * 🆕 로컬에서 XML 파싱
 * 여러 XML 청크를 받아서 이벤트 배열로 변환
 */
export function parseXMLChunksLocally(xmlChunks: string[]): any[] {
  const events: any[] = [];
  const seenIds = new Set<string>();
  
  console.log(`[PARSE] 로컬 파싱 시작: ${xmlChunks.length}개 청크`);
  
  for (const xml of xmlChunks) {
    const chunkEvents = parseKopisXML(xml);
    
    for (const event of chunkEvents) {
      if (!seenIds.has(event.mt20id)) {
        seenIds.add(event.mt20id);
        events.push(event);
      }
    }
  }
  
  console.log(`[PARSE] 로컬 파싱 완료: ${events.length}개 이벤트 (중복 제거 후)`);
  return events;
}

/**
 * KOPIS XML 파싱
 */
function parseKopisXML(xml: string): any[] {
  const events: any[] = [];
  
  // <db> 태그로 각 공연 추출
  const dbMatches = xml.matchAll(/<db>([\s\S]*?)<\/db>/g);
  
  for (const match of dbMatches) {
    const dbContent = match[1];
    
    // 전체 데이터 파싱
    const event = {
      mt20id: extractTag(dbContent, 'mt20id'),
      prfnm: extractTag(dbContent, 'prfnm'),
      prfpdfrom: extractTag(dbContent, 'prfpdfrom'),
      prfpdto: extractTag(dbContent, 'prfpdto'),
      fcltynm: extractTag(dbContent, 'fcltynm'),
      poster: extractTag(dbContent, 'poster'),
      area: extractTag(dbContent, 'area'),
      genrenm: extractTag(dbContent, 'genrenm'),
      prfstate: extractTag(dbContent, 'prfstate'),
      openrun: extractTag(dbContent, 'openrun'),
      prfcast: extractTag(dbContent, 'prfcast'),
      prfcrew: extractTag(dbContent, 'prfcrew'),
      prfruntime: extractTag(dbContent, 'prfruntime'),
      prfage: extractTag(dbContent, 'prfage'),
      entrpsnm: extractTag(dbContent, 'entrpsnm'),
      pcseguidance: extractTag(dbContent, 'pcseguidance'),
      sty: extractTag(dbContent, 'sty'),
      updatedate: extractTag(dbContent, 'updatedate')
    };
    
    if (event.mt20id && event.prfnm) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * 🆕 상세 정보 일괄 조회 (병렬)
 */
export async function fetchDetailsInBatch(
  mt20ids: string[], 
  batchSize: number = 20,  // 🆕 10 → 20으로 증가
  artistName?: string      // 🆕 로그용
): Promise<any[]> {
  const details: any[] = [];
  const startTime = Date.now();
  
  // CULTURE_ ID 필터링 (KOPIS API에서 조회 불가)
  const validIds = mt20ids.filter(id => !id.startsWith('CULTURE_'));
  
  const prefix = artistName ? `[${artistName}]` : '[KOPIS]';
  console.log(`${prefix} 상세 조회 시작: ${validIds.length}개 (배치 크기: ${batchSize})`);
  
  for (let i = 0; i < validIds.length; i += batchSize) {
    const batch = validIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(id => fetchKopisDetail(id));
    const batchResults = await Promise.all(batchPromises);
    
    for (const detail of batchResults) {
      if (detail) {
        details.push(detail);
      }
    }
    
    const progress = Math.min(i + batchSize, mt20ids.length);
    const percent = Math.round((progress / mt20ids.length) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const remaining = mt20ids.length - progress;
    const estimatedTotal = (remaining / progress) * (Date.now() - startTime);
    const eta = remaining > 0 ? Math.round(estimatedTotal / 1000) : 0;
    
    console.log(`${prefix} 상세 조회: ${progress}/${mt20ids.length} (${percent}%) | ${elapsed}초 경과 | 남은시간: ~${eta}초`);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`${prefix} 상세 조회 완료: ${details.length}개 | 총 ${totalTime}초`);
  return details;
}

/**
 * XML에서 태그 값 추출
 */
function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * 공연 상세 정보 조회
 */
export async function fetchKopisDetail(mt20id: string): Promise<any> {
  const url = `${MYGONG_API_KOPIS_DETAIL}/${mt20id}`;
  
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/xml' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xml = await response.text();
    return parseDetailXML(xml);
    
  } catch (error) {
    // console.error(`[KOPIS] 상세 조회 실패 (${mt20id}):`, error);
    return null;
  }
}

/**
 * 상세 정보 XML 파싱
 */
function parseDetailXML(xml: string): any {
  return {
    mt20id: extractTag(xml, 'mt20id'),
    prfnm: extractTag(xml, 'prfnm'),
    prfpdfrom: extractTag(xml, 'prfpdfrom'),
    prfpdto: extractTag(xml, 'prfpdto'),
    fcltynm: extractTag(xml, 'fcltynm'),
    prfcast: extractTag(xml, 'prfcast'),
    prfcrew: extractTag(xml, 'prfcrew'),
    prfruntime: extractTag(xml, 'prfruntime'),
    prfage: extractTag(xml, 'prfage'),
    entrpsnm: extractTag(xml, 'entrpsnm'),
    pcseguidance: extractTag(xml, 'pcseguidance'),
    poster: extractTag(xml, 'poster'),
    sty: extractTag(xml, 'sty'),
    genrenm: extractTag(xml, 'genrenm'),
    prfstate: extractTag(xml, 'prfstate'),
    openrun: extractTag(xml, 'openrun'),
    area: extractTag(xml, 'area'),
    dtguidance: extractTag(xml, 'dtguidance'),  // 🆕 공연시간
    relates: extractTag(xml, 'relates')          // 🆕 관련링크
  };
}
