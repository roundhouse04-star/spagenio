"""
quant_news.py — 뉴스 감성 점수 계산 + DB 저장 (저작권 준수: 원문 즉시 폐기, 점수만 저장).
quant_engine.py 에서 분리.
"""
import os
import sqlite3
from datetime import datetime
from .quant_cache import cache_get, cache_set


# stock.db 경로 (lib/ 의 부모 디렉토리)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'stock.db')

# yfinance lazy load — 모듈 import 시점에서만 한 번
try:
    import yfinance as yf
    YFINANCE_OK = True
except Exception:
    yf = None
    YFINANCE_OK = False


# 긍정 키워드 (종목/시장)
POSITIVE_WORDS = {
    'beat': 1.2, 'record': 1.1, 'growth': 1.0, 'surge': 1.3, 'rally': 1.0,
    'profit': 1.0, 'revenue': 0.8, 'upgrade': 1.2, 'buy': 0.9, 'strong': 0.9,
    'outperform': 1.2, 'boost': 1.0, 'expand': 0.9, 'win': 1.0, 'gain': 0.8,
    'deal': 0.9, 'contract': 0.8, 'approved': 1.1, 'milestone': 1.0,
    # 한국어
    '호조': 1.2, '성장': 1.0, '급증': 1.3, '수주': 1.2, '계약': 0.9,
    '흑자': 1.3, '개선': 0.8, '확대': 0.8, '신기록': 1.3, '승인': 1.0,
    '강세': 0.9, '돌파': 1.0, '상승': 0.8,
}

# 부정 키워드 (종목/시장)
NEGATIVE_WORDS = {
    'miss': -1.2, 'loss': -1.0, 'decline': -0.9, 'fall': -0.8, 'drop': -1.0,
    'cut': -0.9, 'downgrade': -1.2, 'sell': -0.9, 'weak': -0.9, 'risk': -0.8,
    'lawsuit': -1.1, 'fine': -1.0, 'recall': -1.1, 'layoff': -1.0, 'crash': -1.3,
    'bankrupt': -1.5, 'fraud': -1.4, 'investigation': -1.1, 'warn': -0.9,
    # 한국어
    '하락': -0.8, '급락': -1.3, '적자': -1.3, '감소': -0.9, '축소': -0.8,
    '우려': -1.0, '소송': -1.1, '규제': -1.0, '충격': -1.2, '악화': -1.2,
    '부진': -1.0, '경고': -0.9,
}

# 거시 악재 키워드 (시장 전체 리스크)
MACRO_RISK_WORDS = {
    'tariff': -1.2, 'sanction': -1.1, 'recession': -1.4, 'inflation': -0.8,
    'rate hike': -1.0, 'fed tighten': -0.9, 'war': -1.5, 'crisis': -1.3,
    'default': -1.3, 'bubble': -1.0, 'crash': -1.3,
    # 한국어
    '관세': -1.2, '금리 인상': -1.0, '전쟁': -1.5, '침체': -1.4,
    '인플레이션': -0.8, '긴축': -0.9, '경기 둔화': -1.0, '유가 급등': -0.9,
}


def save_news_score_to_db(symbol: str, news_score: float, macro_risk: float,
                          news_count: int, news_label: str):
    """점수(숫자)만 DB 저장 — 원문은 저장하지 않음 (저작권 준수)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO news_sentiment_score
                (symbol, news_score, macro_risk, news_count, news_label, scored_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (symbol, news_score, macro_risk, news_count, news_label))
        conn.commit()
        conn.close()
    except Exception:
        pass


def get_news_score_from_db(symbol: str):
    """오늘 이미 계산된 점수가 DB에 있으면 반환"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT news_score, macro_risk, news_count, news_label
            FROM news_sentiment_score
            WHERE symbol = ? AND DATE(scored_at) = DATE('now')
            ORDER BY scored_at DESC LIMIT 1
        """, (symbol,))
        row = cur.fetchone()
        conn.close()
        if row:
            return {
                'news_score': row[0],
                'macro_risk': row[1],
                'news_count': row[2],
                'news_label': row[3],
            }
    except Exception:
        pass
    return None


def get_news_sentiment(symbol: str, company_name: str = '') -> dict:
    """
    뉴스 감성 점수 계산 — ChatGPT 추천 방식:
    1. 메모리 캐시 확인 (10분)
    2. DB에서 오늘 점수 확인
    3. yfinance로 뉴스 수집 → 점수 계산 → 원문 즉시 폐기
    4. 점수(숫자)만 DB 저장 (저작권 준수)
    """
    if not YFINANCE_OK:
        return {'news_score': 0.0, 'news_count': 0, 'macro_risk': 0.0, 'news_label': '데이터없음'}

    # 1. 메모리 캐시 확인 (10분)
    cache_key = f'news:{symbol}'
    cached = cache_get(cache_key)
    if cached:
        return cached

    # 2. DB에서 오늘 점수 확인
    db_score = get_news_score_from_db(symbol)
    if db_score:
        cache_set(cache_key, db_score)
        return db_score

    # 3. yfinance로 뉴스 수집
    query = company_name if company_name else symbol
    news_items = []
    try:
        search = yf.Search(query, news_count=20)
        news_items = getattr(search, 'news', []) or []
    except Exception:
        pass
    if not news_items:
        try:
            ticker_obj = yf.Ticker(symbol)
            news_items = getattr(ticker_obj, 'news', []) or []
        except Exception:
            pass

    if not news_items:
        empty = {'news_score': 0.0, 'news_count': 0, 'macro_risk': 0.0, 'news_label': '뉴스없음'}
        cache_set(cache_key, empty)
        return empty

    # 4. 점수 계산 (원문은 변수에 잠깐만 존재)
    now_ts = datetime.utcnow().timestamp()
    total_score = 0.0
    all_texts = []

    for item in news_items:
        title   = str(item.get('title', '') or '')
        summary = str(item.get('summary', '') or '')
        text    = f"{title} {summary}".strip().lower()
        all_texts.append(text)

        kw_score = 0.0
        for word, weight in POSITIVE_WORDS.items():
            if word.lower() in text:
                kw_score += weight
        for word, weight in NEGATIVE_WORDS.items():
            if word.lower() in text:
                kw_score += weight

        pub_time = item.get('providerPublishTime')
        if isinstance(pub_time, (int, float)):
            age_days = max((now_ts - pub_time) / 86400, 0)
            recency  = 1.0 / (1.0 + age_days * 0.25)
        else:
            recency = 0.7

        total_score += kw_score * recency

    avg_score = total_score / max(len(news_items), 1)

    # 거시 리스크
    joined = ' '.join(all_texts)
    macro_risk = 0.0
    for word, weight in MACRO_RISK_WORDS.items():
        if word.lower() in joined:
            macro_risk += weight

    # ★ 원문 즉시 폐기 (저작권 준수)
    news_count_val = len(news_items)
    del all_texts, news_items, joined

    # 라벨
    net = avg_score + macro_risk * 0.3
    if net > 0.3:
        label = '📰 긍정'
    elif net < -0.3:
        label = '📰 부정'
    else:
        label = '📰 중립'

    result = {
        'news_score': round(avg_score, 3),
        'news_count': news_count_val,
        'macro_risk': round(macro_risk, 3),
        'news_label': label,
    }

    # 5. 점수(숫자)만 DB 저장 — 원문 없음
    save_news_score_to_db(symbol, result['news_score'], result['macro_risk'],
                          news_count_val, label)

    # 메모리 캐시 (10분)
    cache_set(cache_key, result)
    return result
