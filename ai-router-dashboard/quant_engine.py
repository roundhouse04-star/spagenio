"""
quant_engine.py
퀀트 분석 엔진 - pandas_ta 없이 직접 구현
기존 stock_server.py와 통합되어 포트 5001에서 실행

============================================================
[Finnhub 전환 가이드]
현재: yfinance (개인용, 비공식)
대안: Finnhub (상업적 사용 허용, 무료 60콜/분)

전환 방법:
1. https://finnhub.io/register 에서 무료 API 키 발급
2. .env 파일에 FINNHUB_API_KEY=your_key 추가
3. 이 파일에서 USE_FINNHUB = True 로 변경 (약 30번째 줄)

전환 범위:
- ✅ 미국 주식 주가/차트 데이터
- ✅ 미국 주식 재무지표 (PER/PBR/ROE/부채비율)
- ✅ 미국 주식 팩터 스크리닝
- ✅ 애널리스트 목표가/추천
- ❌ 한국 주식 (.KS/.KQ) — yfinance/pykrx 유지
============================================================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import math
from datetime import datetime, timedelta
import threading
import time

# yfinance, pykrx
try:
    import yfinance as yf
    YFINANCE_OK = True
except:
    YFINANCE_OK = False

# ============================================================
# FINNHUB 설정 (상업적 사용 가능 - yfinance 대체용)
# 사용법: .env에 FINNHUB_API_KEY=your_key 추가
# API 키 발급: https://finnhub.io/register (무료)
# 교체 시: USE_FINNHUB = True 로 변경
# ============================================================
import requests as _requests
FINNHUB_API_KEY = os.environ.get('FINNHUB_API_KEY', '')
FINNHUB_BASE = 'https://finnhub.io/api/v1'
USE_FINNHUB = False  # True로 바꾸면 미국 주식 데이터를 Finnhub으로 조회

def _finnhub_get(endpoint, params={}):
    """Finnhub API 공통 호출 함수"""
    try:
        p = {**params, 'token': FINNHUB_API_KEY}
        res = _requests.get(f'{FINNHUB_BASE}{endpoint}', params=p, timeout=10)
        return res.json() if res.status_code == 200 else {}
    except Exception as e:
        print(f'[Finnhub] 오류: {e}')
        return {}

def _is_us_symbol(symbol):
    """미국 주식 심볼 여부 판단 (한국 제외)"""
    return not (symbol.endswith('.KS') or symbol.endswith('.KQ'))

def get_stock_data_finnhub(symbol, period_days=300):
    """Finnhub으로 주가 데이터 가져오기 (yfinance 대체)"""
    import time as _time
    end = int(_time.time())
    start = end - period_days * 24 * 3600
    data = _finnhub_get('/stock/candle', {
        'symbol': symbol, 'resolution': 'D',
        'from': start, 'to': end
    })
    if not data or data.get('s') != 'ok':
        return None
    closes = data.get('c', [])
    volumes = data.get('v', [])
    timestamps = data.get('t', [])
    if not closes:
        return None
    from datetime import datetime as _dt
    dates = [_dt.fromtimestamp(t).strftime('%Y-%m-%d') for t in timestamps]
    return {
        'closes': closes,
        'volumes': volumes,
        'last_price': round(float(closes[-1]), 2),
        'dates': dates
    }

def get_factor_data_finnhub(symbol):
    """Finnhub으로 팩터 데이터 가져오기 (yfinance 대체)"""
    import time as _time
    # 기본 재무지표
    metrics = _finnhub_get('/stock/metric', {'symbol': symbol, 'metric': 'all'})
    profile = _finnhub_get('/stock/profile2', {'symbol': symbol})
    quote = _finnhub_get('/quote', {'symbol': symbol})

    m = metrics.get('metric', {})
    current_price = quote.get('c') or quote.get('pc')

    # 모멘텀 계산용 캔들 데이터
    end = int(_time.time())
    start = end - 400 * 24 * 3600
    candle = _finnhub_get('/stock/candle', {
        'symbol': symbol, 'resolution': 'D',
        'from': start, 'to': end
    })
    closes = candle.get('c', []) if candle.get('s') == 'ok' else []

    momentum_3m = momentum_6m = momentum_12m = sma200 = above_sma200 = None
    if len(closes) >= 60:
        price_now = closes[-1]
        price_3m  = closes[-63]  if len(closes) >= 63  else closes[0]
        price_6m  = closes[-126] if len(closes) >= 126 else closes[0]
        price_12m = closes[-252] if len(closes) >= 252 else closes[0]
        momentum_3m  = round((price_now - price_3m)  / price_3m  * 100, 2)
        momentum_6m  = round((price_now - price_6m)  / price_6m  * 100, 2)
        momentum_12m = round((price_now - price_12m) / price_12m * 100, 2)
        if len(closes) >= 200:
            sma200 = round(sum(closes[-200:]) / 200, 2)
            above_sma200 = 1 if price_now > sma200 else 0

    per = m.get('peBasicExclExtraTTM') or m.get('peTTM')
    pbr = m.get('pbAnnual') or m.get('pbQuarterly')
    roe = m.get('roeTTM')  # % 단위
    debt_to_equity = m.get('totalDebt/totalEquityAnnual')
    revenue_growth = m.get('revenueGrowthTTMYoy')
    market_cap = profile.get('marketCapitalization', 0) * 1e6 if profile.get('marketCapitalization') else 0

    return {
        'symbol': symbol,
        'per': round(per, 2) if per else None,
        'pbr': round(pbr, 2) if pbr else None,
        'roe': round(roe, 4) if roe else None,  # 소수점 형식 유지
        'debt_to_equity': round(debt_to_equity, 2) if debt_to_equity else None,
        'revenue_growth': round(revenue_growth / 100, 4) if revenue_growth else None,
        'market_cap': market_cap,
        'current_price': current_price,
        'volume': m.get('10DayAverageTradingVolume', 0) * 1e6,
        'momentum_3m': momentum_3m,
        'momentum_6m': momentum_6m,
        'momentum_12m': momentum_12m,
        'sma200': sma200,
        'above_sma200': above_sma200,
        'name': profile.get('name', symbol),
        'sector': profile.get('finnhubIndustry', ''),
    }

def get_stock_analysis_finnhub(symbol):
    """Finnhub으로 종목 분석 데이터 가져오기 (yfinance 대체)"""
    import time as _time
    quote = _finnhub_get('/quote', {'symbol': symbol})
    profile = _finnhub_get('/stock/profile2', {'symbol': symbol})
    metrics = _finnhub_get('/stock/metric', {'symbol': symbol, 'metric': 'all'})
    # 애널리스트 목표가
    target = _finnhub_get('/stock/price-target', {'symbol': symbol})
    # 추천
    rec_list = _finnhub_get('/stock/recommendation', {'symbol': symbol})
    rec = rec_list[0] if rec_list else {}

    m = metrics.get('metric', {})
    current_price = quote.get('c')
    prev_close = quote.get('pc')
    change_pct = round((current_price - prev_close) / prev_close * 100, 2) if current_price and prev_close else None

    target_mean = target.get('targetMean')
    upside_pct = round((target_mean - current_price) / current_price * 100, 2) if target_mean and current_price else None

    # 추천 집계 (buy/hold/sell)
    total = (rec.get('buy', 0) + rec.get('hold', 0) + rec.get('sell', 0) +
             rec.get('strongBuy', 0) + rec.get('strongSell', 0))
    buy_cnt = rec.get('buy', 0) + rec.get('strongBuy', 0)
    sell_cnt = rec.get('sell', 0) + rec.get('strongSell', 0)
    if total > 0:
        if buy_cnt / total > 0.6: recommendation = 'buy'
        elif sell_cnt / total > 0.4: recommendation = 'sell'
        else: recommendation = 'hold'
    else:
        recommendation = None

    return {
        'ok': True,
        'symbol': symbol,
        'current_price': current_price,
        'prev_close': prev_close,
        'change_pct': change_pct,
        'consensus': {
            'target_mean': target_mean,
            'target_high': target.get('targetHigh'),
            'target_low': target.get('targetLow'),
            'recommendation': recommendation,
            'analyst_count': total,
            'upside_pct': upside_pct,
        },
        'fundamentals': {
            'per': round(m.get('peBasicExclExtraTTM', 0), 2) if m.get('peBasicExclExtraTTM') else None,
            'pbr': round(m.get('pbAnnual', 0), 2) if m.get('pbAnnual') else None,
            'roe': round(m.get('roeTTM', 0), 2) if m.get('roeTTM') else None,
            'debt_to_equity': round(m.get('totalDebt/totalEquityAnnual', 0), 2) if m.get('totalDebt/totalEquityAnnual') else None,
            'revenue_growth': round(m.get('revenueGrowthTTMYoy', 0), 2) if m.get('revenueGrowthTTMYoy') else None,
            'fifty_two_week_high': m.get('52WeekHigh'),
            'fifty_two_week_low': m.get('52WeekLow'),
            'market_cap': profile.get('marketCapitalization', 0) * 1e6 if profile.get('marketCapitalization') else None,
            'volume': quote.get('v'),
            'name': profile.get('name', symbol),
            'sector': profile.get('finnhubIndustry', ''),
            'industry': profile.get('finnhubIndustry', ''),
        },
    }

try:
    from pykrx import stock as krx_stock
    PYKRX_OK = True
except:
    PYKRX_OK = False

# Alpaca
try:
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
    ALPACA_OK = True
except:
    ALPACA_OK = False

# ===== 설정 =====
ALPACA_API_KEY = os.environ.get('ALPACA_API_KEY', '')
ALPACA_SECRET_KEY = os.environ.get('ALPACA_SECRET_KEY', '')
DB_PATH = os.path.join(os.path.dirname(__file__), 'stock.db')

app = Flask(__name__)

# CORS: 대시보드(Express) origin만 허용. 환경변수로 override 가능.
_cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGIN', 'http://localhost:3000').split(',') if o.strip()]
CORS(app, origins=_cors_origins)

# 내부 호출 토큰 (Node 대시보드 → Python 서비스). 비어있으면 mutating 엔드포인트 차단.
INTERNAL_API_TOKEN = os.environ.get('INTERNAL_API_TOKEN', '')

# 1회 주문 최대 수량 한도 (사고 방지).
MAX_ORDER_QTY = int(os.environ.get('MAX_ORDER_QTY', '10'))


def require_internal_token(f):
    """mutating 엔드포인트 보호: X-Internal-Token 헤더 검증."""
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not INTERNAL_API_TOKEN:
            return jsonify({'error': 'INTERNAL_API_TOKEN not configured on server'}), 503
        if request.headers.get('X-Internal-Token') != INTERNAL_API_TOKEN:
            return jsonify({'error': 'forbidden'}), 403
        return f(*args, **kwargs)
    return wrapper


# 캐시 / 뉴스 감성은 lib/ 로 분리 (모놀리식 정리)
from lib.quant_cache import cache_get, cache_set, cache_clear_expired
from lib.quant_news import (get_news_sentiment, save_news_score_to_db,
    get_news_score_from_db, POSITIVE_WORDS, NEGATIVE_WORDS, MACRO_RISK_WORDS)


# ===== DB 초기화 =====
def init_quant_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 퀀트 분석 결과 테이블
    cur.execute("""
        CREATE TABLE IF NOT EXISTS quant_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            strategy TEXT NOT NULL,
            signal TEXT NOT NULL,
            indicator_value REAL,
            price REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 한국 수급 추천 종목 테이블
    cur.execute("""
        CREATE TABLE IF NOT EXISTS kr_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            name TEXT,
            volume REAL,
            short_ratio REAL,
            score REAL,
            price REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 매매 로그 테이블
    cur.execute("""
        CREATE TABLE IF NOT EXISTS quant_trade_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            qty REAL,
            price REAL,
            strategy TEXT,
            order_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 뉴스 감성 점수 테이블
    # ※ 원문(제목/본문)은 저장하지 않음 — 점수(숫자)만 저장 (저작권 준수)
    # ※ 숫자 데이터는 저작권 보호 대상 아님
    cur.execute("""
        CREATE TABLE IF NOT EXISTS news_sentiment_score (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            news_score REAL NOT NULL,       -- 종목 감성 점수 (-∞ ~ +∞)
            macro_risk REAL NOT NULL,       -- 거시 리스크 점수
            news_count INTEGER NOT NULL,    -- 분석한 기사 수
            news_label TEXT,                -- 긍정/중립/부정
            scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(symbol, DATE(scored_at)) -- 하루 1회 유지
        )
    """)

    conn.commit()
    conn.close()
    print("✅ 퀀트 DB 초기화 완료")

init_quant_db()


# 퀀트 지표 함수들은 lib/quant_indicators.py 로 분리 (모놀리식 정리)
from lib.quant_indicators import (
    calc_rsi, calc_sma, calc_ema, calc_bollinger_bands, calc_macd,
    calc_rsi_series, calc_bollinger_series, calc_macd_series,
)



def get_stock_data(symbol, period_days=60):
    """주가 데이터 가져오기 (USE_FINNHUB=True 시 Finnhub, 기본 yfinance)"""
    # Finnhub 교체 분기
    if USE_FINNHUB and _is_us_symbol(symbol):
        return get_stock_data_finnhub(symbol, period_days)
    if not YFINANCE_OK:
        return None
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=f"{period_days}d")
        if hist.empty:
            return None
        # NaN 행 제거 (장 마감 전 당일 데이터 등)
        hist = hist.dropna(subset=['Close'])
        if hist.empty:
            return None
        closes = list(hist['Close'].values)
        volumes = list(hist['Volume'].values)
        return {
            'closes': closes,
            'volumes': volumes,
            'last_price': round(float(closes[-1]), 2),
            'dates': [str(d.date()) for d in hist.index]
        }
    except Exception as e:
        print(f"데이터 수집 오류 ({symbol}): {e}")
        return None


# ===== 퀀트 전략 분석 =====

def analyze_rsi(symbol):
    """RSI 전략 분석"""
    data = get_stock_data(symbol)
    if not data:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 없음'}

    rsi = calc_rsi(data['closes'], 14)
    if rsi is None:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 부족'}

    if rsi < 30:
        signal = 'buy'
        reason = f'RSI {rsi} - 과매도 구간 (매수 신호)'
    elif rsi > 70:
        signal = 'sell'
        reason = f'RSI {rsi} - 과매수 구간 (매도 신호)'
    else:
        signal = 'hold'
        reason = f'RSI {rsi} - 중립 구간'

    return {
        'signal': signal,
        'value': rsi,
        'price': data['last_price'],
        'reason': reason
    }


def analyze_bb(symbol):
    """볼린저 밴드 전략 분석"""
    data = get_stock_data(symbol)
    if not data:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 없음'}

    upper, mid, lower = calc_bollinger_bands(data['closes'], 20, 2)
    if upper is None:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 부족'}

    price = data['last_price']
    if price <= lower:
        signal = 'buy'
        reason = f'가격 {price} ≤ 하단밴드 {lower} (매수 신호)'
    elif price >= upper:
        signal = 'sell'
        reason = f'가격 {price} ≥ 상단밴드 {upper} (매도 신호)'
    else:
        signal = 'hold'
        reason = f'밴드 내 ({lower} ~ {upper})'

    return {
        'signal': signal,
        'value': price,
        'price': price,
        'upper': upper,
        'mid': mid,
        'lower': lower,
        'reason': reason
    }


def analyze_sma(symbol, short=5, long=20):
    """SMA 이동평균 교차 전략"""
    data = get_stock_data(symbol)
    if not data:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 없음'}

    sma_s = calc_sma(data['closes'], short)
    sma_l = calc_sma(data['closes'], long)

    if sma_s is None or sma_l is None:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 부족'}

    if sma_s > sma_l:
        signal = 'buy'
        reason = f'단기SMA({short}일) {sma_s} > 장기SMA({long}일) {sma_l} (골든크로스)'
    elif sma_s < sma_l:
        signal = 'sell'
        reason = f'단기SMA({short}일) {sma_s} < 장기SMA({long}일) {sma_l} (데드크로스)'
    else:
        signal = 'hold'
        reason = '이동평균 동일'

    return {
        'signal': signal,
        'value': sma_s,
        'price': data['last_price'],
        'sma_short': sma_s,
        'sma_long': sma_l,
        'reason': reason
    }


def analyze_macd(symbol):
    """MACD 전략 — 표준: MACD line vs signal line 크로스오버 (이전엔 raw MACD vs 0)."""
    data = get_stock_data(symbol)
    if not data:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 없음'}

    macd, sig = calc_macd(data['closes'])
    if macd is None or sig is None:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 부족'}

    diff = round(macd - sig, 4)
    if diff > 0:
        signal = 'buy'
        reason = f'MACD {macd} > signal {sig} (골든크로스, +{diff})'
    elif diff < 0:
        signal = 'sell'
        reason = f'MACD {macd} < signal {sig} (데드크로스, {diff})'
    else:
        signal = 'hold'
        reason = 'MACD = signal (전환점)'

    return {
        'signal': signal,
        'value': macd,
        'signal_line': sig,
        'price': data['last_price'],
        'reason': reason
    }


def analyze_combined(symbol):
    """복합 전략 - RSI + BB + SMA + MACD 가중치 점수"""
    results = {
        'RSI': analyze_rsi(symbol),
        'BB': analyze_bb(symbol),
        'SMA': analyze_sma(symbol),
        'MACD': analyze_macd(symbol)
    }

    # 가중치 점수 계산
    weights = {'RSI': 0.3, 'BB': 0.25, 'SMA': 0.25, 'MACD': 0.2}
    score = 0
    for strategy, weight in weights.items():
        sig = results[strategy].get('signal', 'hold')
        if sig == 'buy':
            score += weight
        elif sig == 'sell':
            score -= weight

    if score >= 0.3:
        final_signal = 'buy'
        final_reason = f'복합 점수 {score:.2f} - 강한 매수 신호'
    elif score <= -0.3:
        final_signal = 'sell'
        final_reason = f'복합 점수 {score:.2f} - 강한 매도 신호'
    elif score > 0:
        final_signal = 'weak_buy'
        final_reason = f'복합 점수 {score:.2f} - 약한 매수 신호'
    elif score < 0:
        final_signal = 'weak_sell'
        final_reason = f'복합 점수 {score:.2f} - 약한 매도 신호'
    else:
        final_signal = 'hold'
        final_reason = '중립'

    price = results['RSI'].get('price') or results['BB'].get('price') or 0

    return {
        'signal': final_signal,
        'score': round(score, 4),
        'price': price,
        'reason': final_reason,
        'details': results
    }


def save_analysis(symbol, strategy, signal, value, price):
    """분석 결과 DB 저장"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            INSERT INTO quant_analysis (symbol, strategy, signal, indicator_value, price)
            VALUES (?, ?, ?, ?, ?)
        """, (symbol, strategy, signal, value, price))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB 저장 오류: {e}")


# ===== 한국 시장 수급 분석 =====

def get_naver_top_stocks(market='kospi', limit=20):
    """네이버 금융 거래량 상위 종목 크롤링"""
    import requests
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    sosok = '0' if market == 'kospi' else '1'
    url = f'https://finance.naver.com/sise/sise_quant.naver?sosok={sosok}'
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

    try:
        res = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        rows = soup.select('table.type_2 tr')

        items = []
        for row in rows:
            cols = row.select('td')
            if len(cols) < 8:
                continue
            try:
                rank = cols[0].text.strip()
                if not rank.isdigit():
                    continue
                name = cols[1].text.strip()
                price_text = cols[2].text.strip().replace(',', '')
                volume_text = cols[6].text.strip().replace(',', '')
                price = float(price_text) if price_text else 0
                volume = float(volume_text) if volume_text else 0

                # 종목코드 추출
                link = cols[1].select_one('a')
                ticker = ''
                if link and 'code=' in link.get('href', ''):
                    ticker = link['href'].split('code=')[-1][:6]

                items.append({
                    'rank': int(rank),
                    'name': name,
                    'ticker': ticker,
                    'market': market,  # 'kospi' or 'kosdaq' — ticker suffix 결정용
                    'price': price,
                    'volume': volume
                })
                if len(items) >= limit:
                    break
            except:
                continue
        return items
    except Exception as e:
        print(f'네이버 크롤링 오류: {e}')
        return []


def get_korea_market_analysis():
    """한국 시장 거래량 상위 + RSI 분석 TOP 10 (네이버 금융)"""
    try:
        # 네이버 금융에서 거래량 상위 20개 가져오기
        items = get_naver_top_stocks('kospi', 20)

        if not items:
            return {'error': '한국 시장 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.'}

        print(f'네이버 금융 데이터: {len(items)}개 종목 수집')

        # 복합 점수 계산
        # vol_score 분모를 실제 list 길이 기반으로 (이전: 하드코딩 20 → limit 변경 시 음수 가능)
        denom = max(len(items), 1)
        results = []
        for idx, item in enumerate(items):
            ticker = item.get('ticker', '')
            name = item.get('name', '')
            price = item.get('price', 0)
            volume = item.get('volume', 0)

            # 거래량 순위 점수 (0~50, 1등이 50점)
            vol_score = max(0, (denom - idx)) / denom * 50

            # RSI 보너스 (yfinance로 한국 주식)
            # 시장(KOSPI/KOSDAQ)에 따라 정확한 suffix 사용
            # (이전: 무조건 .KS → KOSDAQ 종목은 빈 응답으로 점수 0)
            rsi_score = 0
            try:
                if ticker:
                    suffix = '.KS' if item.get('market', 'kospi') == 'kospi' else '.KQ'
                    kr_symbol = ticker + suffix
                    rsi_result = analyze_rsi(kr_symbol)
                    if rsi_result.get('signal') == 'buy':
                        rsi_score = 20
                    elif rsi_result.get('signal') == 'sell':
                        rsi_score = -10
            except:
                pass

            total_score = vol_score + rsi_score
            short_ratio = 0

            results.append({
                'ticker': ticker,
                'name': name,
                'price': price,
                'volume': volume,
                'short_ratio': short_ratio,
                'score': round(total_score, 2)
            })

        # 점수 내림차순 TOP 10
        results.sort(key=lambda x: x['score'], reverse=True)
        top10 = results[:10]

        # DB 저장
        conn = sqlite3.connect(DB_PATH)
        for item in top10:
            conn.execute("""
                INSERT INTO kr_recommendations (ticker, name, volume, short_ratio, score, price)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (item['ticker'], item['name'], item['volume'],
                  item['short_ratio'], item['score'], item['price']))
        conn.commit()
        conn.close()

        return {'top10': top10, 'updated_at': datetime.now().isoformat()}

    except Exception as e:
        return {'error': str(e)}


# ===== Alpaca 매매 =====

def get_alpaca_client():
    if not ALPACA_OK or not ALPACA_API_KEY:
        return None
    try:
        paper = os.environ.get('ALPACA_PAPER', 'true').lower() == 'true'
        return TradingClient(ALPACA_API_KEY, ALPACA_SECRET_KEY, paper=paper)
    except:
        return None


def execute_quant_trade(symbol, signal, strategy, price, qty=1):
    """퀀트 신호에 따른 Alpaca 매매 실행"""
    client = get_alpaca_client()
    if not client:
        return {'error': 'Alpaca 연결 실패'}

    try:
        side = OrderSide.BUY if signal == 'buy' else OrderSide.SELL
        order_req = MarketOrderRequest(
            symbol=symbol,
            qty=qty,
            side=side,
            time_in_force=TimeInForce.GTC
        )
        order = client.submit_order(order_req)

        # DB 저장
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            INSERT INTO quant_trade_log (symbol, side, qty, price, strategy, order_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (symbol, signal, qty, price, strategy, str(order.id)))
        conn.commit()
        conn.close()

        return {'status': 'ok', 'order_id': str(order.id), 'symbol': symbol, 'side': signal}

    except Exception as e:
        return {'error': str(e)}


# ===== API 엔드포인트 =====


import math as _math

def _sanitize(obj):
    if isinstance(obj, float) and (_math.isnan(obj) or _math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj

@app.after_request
def sanitize_nan(response):
    if response.content_type == 'application/json':
        try:
            data = response.get_json(force=True, silent=True)
            if data is not None:
                import json
                response.set_data(json.dumps(_sanitize(data)))
        except Exception:
            pass
    return response

@app.route('/api/quant/analyze', methods=['POST'])
def analyze():
    """단일 종목 퀀트 분석"""
    data = request.get_json(silent=True) or {}
    symbol = data.get('symbol', 'AAPL')
    strategy = data.get('strategy', 'combined')

    strategy_map = {
        'rsi': analyze_rsi,
        'bb': analyze_bb,
        'sma': analyze_sma,
        'macd': analyze_macd,
        'combined': analyze_combined
    }

    func = strategy_map.get(strategy.lower(), analyze_combined)
    result = func(symbol)

    # DB 저장
    save_analysis(
        symbol, strategy,
        result.get('signal', 'hold'),
        result.get('value') or result.get('score'),
        result.get('price', 0)
    )

    return jsonify({'symbol': symbol, 'strategy': strategy, **result})


@app.route('/api/quant/analyze/batch', methods=['POST'])
def analyze_batch():
    """여러 종목 동시 분석"""
    data = request.get_json(silent=True) or {}
    symbols = data.get('symbols', ['AAPL', 'NVDA', 'MSFT'])
    strategy = data.get('strategy', 'combined')

    results = []
    for symbol in symbols:
        try:
            if strategy == 'combined':
                result = analyze_combined(symbol)
            elif strategy == 'rsi':
                result = analyze_rsi(symbol)
            elif strategy == 'bb':
                result = analyze_bb(symbol)
            elif strategy == 'sma':
                result = analyze_sma(symbol)
            else:
                result = analyze_combined(symbol)

            save_analysis(symbol, strategy, result.get('signal', 'hold'),
                         result.get('value') or result.get('score'), result.get('price', 0))
            results.append({'symbol': symbol, **result})
        except Exception as e:
            results.append({'symbol': symbol, 'error': str(e), 'signal': 'hold'})

    # 신호별 정렬 (buy 먼저)
    signal_order = {'buy': 0, 'weak_buy': 1, 'hold': 2, 'weak_sell': 3, 'sell': 4}
    results.sort(key=lambda x: signal_order.get(x.get('signal', 'hold'), 2))

    return jsonify({'results': results, 'count': len(results)})


@app.route('/api/quant/korea', methods=['GET'])
def korea_analysis():
    """한국 시장 수급 분석"""
    result = get_korea_market_analysis()
    return jsonify(result)


@app.route('/api/quant/history', methods=['GET'])
def history():
    """분석 히스토리 조회"""
    symbol = request.args.get('symbol', '')
    limit = int(request.args.get('limit', 50))

    conn = sqlite3.connect(DB_PATH)
    if symbol:
        rows = conn.execute("""
            SELECT * FROM quant_analysis WHERE symbol = ?
            ORDER BY created_at DESC LIMIT ?
        """, (symbol, limit)).fetchall()
    else:
        rows = conn.execute("""
            SELECT * FROM quant_analysis
            ORDER BY created_at DESC LIMIT ?
        """, (limit,)).fetchall()
    conn.close()

    return jsonify({'history': [
        {'id': r[0], 'symbol': r[1], 'strategy': r[2], 'signal': r[3],
         'value': r[4], 'price': r[5], 'created_at': r[6]}
        for r in rows
    ]})


@app.route('/api/quant/kr/history', methods=['GET'])
def kr_history():
    """한국 수급 추천 히스토리"""
    limit = int(request.args.get('limit', 30))
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("""
        SELECT * FROM kr_recommendations ORDER BY created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return jsonify({'history': [
        {'id': r[0], 'ticker': r[1], 'name': r[2], 'volume': r[3],
         'short_ratio': r[4], 'score': r[5], 'price': r[6], 'created_at': r[7]}
        for r in rows
    ]})


@app.route('/api/quant/trade', methods=['POST'])
@require_internal_token
def trade():
    """퀀트 신호 기반 매매 실행"""
    data = request.get_json(silent=True) or {}
    symbol = (data.get('symbol') or '').strip().upper()
    signal = data.get('signal')  # buy or sell
    strategy = data.get('strategy', 'manual')
    try:
        qty = int(data.get('qty', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'qty must be integer'}), 400

    if not symbol or signal not in ['buy', 'sell']:
        return jsonify({'error': '종목 또는 신호 오류'}), 400
    if qty <= 0 or qty > MAX_ORDER_QTY:
        return jsonify({'error': f'qty out of range (1..{MAX_ORDER_QTY})'}), 400

    # 자동 분석 후 매매
    analysis = analyze_combined(symbol)
    price = analysis.get('price', 0)

    result = execute_quant_trade(symbol, signal, strategy, price, qty)
    return jsonify(result)


@app.route('/api/quant/trade/log', methods=['GET'])
def trade_log():
    """매매 로그 조회"""
    limit = int(request.args.get('limit', 20))
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("""
        SELECT * FROM quant_trade_log ORDER BY created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return jsonify({'logs': [
        {'id': r[0], 'symbol': r[1], 'side': r[2], 'qty': r[3],
         'price': r[4], 'strategy': r[5], 'order_id': r[6], 'created_at': r[7]}
        for r in rows
    ]})


@app.route('/api/quant/auto', methods=['POST'])
@require_internal_token
def auto_trade():
    """자동매매 - 분석 후 신호에 따라 자동 주문"""
    data = request.get_json(silent=True) or {}
    symbol = (data.get('symbol') or 'QQQ').strip().upper()
    strategy = data.get('strategy', 'combined')
    try:
        qty = int(data.get('qty', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'qty must be integer'}), 400
    if qty <= 0 or qty > MAX_ORDER_QTY:
        return jsonify({'error': f'qty out of range (1..{MAX_ORDER_QTY})'}), 400
    threshold = float(data.get('threshold', 0.3))  # 최소 신호 강도

    # 분석
    analysis = analyze_combined(symbol)
    signal = analysis.get('signal', 'hold')
    score = abs(analysis.get('score', 0))

    # 임계값 이상일 때만 매매
    if signal in ['buy', 'sell'] and score >= threshold:
        trade_result = execute_quant_trade(symbol, signal, strategy, analysis.get('price', 0), qty)
        return jsonify({
            'traded': True,
            'analysis': analysis,
            'trade': trade_result
        })

    return jsonify({
        'traded': False,
        'reason': f'신호 강도 부족 (score: {score:.2f} < threshold: {threshold})',
        'analysis': analysis
    })


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'yfinance': YFINANCE_OK,
        'pykrx': PYKRX_OK,
        'alpaca': ALPACA_OK
    })


@app.route('/api/quant/chart', methods=['GET'])
def get_chart_data():
    """종목 차트 데이터 (주가 + 거래량 + RSI + BB + MACD).
    이전 코드는 scalar 반환 함수 (calc_rsi/calc_bollinger/calc_macd) 를 시계열처럼
    인덱싱해서 silent except → 모든 지표 None 으로 응답하던 버그가 있었음.
    이제 calc_*_series 사용."""
    symbol = request.args.get('symbol', 'AAPL')
    period = request.args.get('period', '3mo')  # 1mo, 3mo, 6mo, 1y
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period)
        if df.empty:
            return jsonify({'error': f'{symbol} 데이터 없음'}), 404

        closes = df['Close'].values.tolist()
        opens  = df['Open'].values.tolist()
        highs  = df['High'].values.tolist()
        lows   = df['Low'].values.tolist()
        vols   = df['Volume'].values.tolist()
        dates  = [str(d.date()) for d in df.index]
        n = len(closes)

        # RSI / 볼린저 / MACD — 시계열 (길이 = n, warmup 구간은 None)
        rsi_vals = calc_rsi_series(closes, 14)
        bb_upper, bb_mid, bb_lower = calc_bollinger_series(closes, 20)
        macd_line, signal_line, macd_hist = calc_macd_series(closes)

        # SMA 20, 50 시계열
        def sma_series(period_):
            s = [None] * n
            if n >= period_:
                for i in range(period_ - 1, n):
                    s[i] = round(sum(closes[i - period_ + 1:i + 1]) / period_, 4)
            return s
        sma20 = sma_series(20)
        sma50 = sma_series(50)

        return jsonify({
            'symbol': symbol,
            'dates': dates,
            'ohlc': {'open': opens, 'high': highs, 'low': lows, 'close': closes},
            'volume': vols,
            'rsi': rsi_vals,
            'bb': {'upper': bb_upper, 'middle': bb_mid, 'lower': bb_lower},
            'macd': {'macd': macd_line, 'signal': signal_line, 'histogram': macd_hist},
            'sma': {'sma20': sma20, 'sma50': sma50}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 팩터 기반 퀀트 스크리너 =====


SP500_SYMBOLS = [
    # 정보기술
    'AAPL','MSFT','NVDA','AVGO','ORCL','ADBE','CSCO','CRM','AMD','ACN',
    'INTC','QCOM','IBM','TXN','AMAT','MU','INTU','KLAC','LRCX','SNPS',
    'CDNS','MCHP','CTSH','FTNT','ANSS','KEYS','EPAM','MPWR','ENPH','ON',
    # 통신/미디어
    'GOOGL','META','NFLX','TMUS','VZ','T','DIS','CMCSA','ATVI','EA',
    # 헬스케어
    'UNH','JNJ','LLY','ABBV','MRK','TMO','ABT','DHR','BMY','AMGN',
    'ISRG','SYK','REGN','VRTX','ZTS','ELV','CI','HCA','IDXX','DXCM',
    # 금융
    'BRK.B','JPM','BAC','WFC','GS','MS','BLK','SCHW','CB','AXP',
    'PGR','MMC','AON','TRV','MET','PRU','AFL','ALL','ICE','CME',
    # 필수소비재
    'AMZN','WMT','PG','KO','PEP','COST','MDLZ','CL','GIS','K',
    'MCD','SBUX','YUM','DG','DLTR','KR','SYY','HSY','MKC','CHD',
    # 에너지
    'XOM','CVX','COP','EOG','SLB','MPC','PSX','VLO','OXY','PXD',
    # 산업재
    'CAT','HON','UPS','RTX','BA','LMT','GE','MMM','EMR','ETN',
    'ITW','PH','FDX','CSX','NSC','UNP','DE','ROK','CARR','OTIS',
    # 소재
    'LIN','APD','SHW','ECL','DD','NEM','FCX','NUE','VMC','MLM',
    # 유틸리티
    'NEE','DUK','SO','AEP','EXC','XEL','WEC','ES','ETR','PPL',
    # 부동산
    'AMT','PLD','CCI','EQIX','PSA','DLR','O','WELL','SPG','EQR',
    # 임의소비재
    'TSLA','HD','TGT','LOW','NKE','TJX','ROST','ORLY','AZO','BBY',
    'ABNB','BKNG','MAR','HLT','GM','F','APTV','LVS','WYNN','MGM',
]

RUSSELL1000_SYMBOLS = [
    # S&P500 포함 + 중형주 추가
    'AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','BRK.B','AVGO','JPM',
    'LLY','UNH','XOM','JNJ','V','PG','MA','HD','COST','CVX',
    'MRK','ABBV','CRM','BAC','NFLX','AMD','KO','PEP','TMO','WMT',
    'ORCL','ACN','MCD','ADBE','CSCO','ABT','QCOM','CAT','DHR','TXN',
    'WFC','LIN','INTU','PM','HON','AMGN','IBM','GE','NEE','GS',
    'SPGI','BKNG','RTX','ISRG','C','LOW','AMAT','BX','SYK','TJX',
    'UBER','UNP','BA','AXP','MS','SBUX','NOW','LRCX','KLAC','REGN',
    'MU','VRTX','DE','PANW','GILD','MMC','ADI','MDLZ','SNPS','CDNS',
    'CME','PGR','ELV','ZTS','CB','ETN','BMY','BSX','SCHW','APH',
    'SO','DUK','SHW','ICE','AON','CL','HCA','FTNT','EOG','ITW',
    # 중형주
    'COIN','PLTR','RBLX','HOOD','RIVN','LCID','SOFI','AFRM','UPST','SQ',
    'ROKU','DKNG','PENN','LYFT','DASH','ABNB','SNAP','PINS','MTCH','Z',
    'W','ETSY','CHWY','CVNA','CARVANA','LULU','RH','SKX','DECK','CROX',
    'CELH','ELF','USFD','SFM','PFGC','CHEF','CAKE','TXRH','JACK','WEN',
    'HWM','TDY','LDOS','SAIC','BAH','CACI','MANT','DRS','VVV','WMS',
    'TREX','AZEK','PGTI','NVR','MTH','MHO','GRBK','CCS','TPH','BLD',
    'RRC','AR','CTRA','SM','CHRD','NOG','ESTE','VTLE','SWN','EQT',
    'FANG','DVN','PDCE','PR','CPE','MTDR','REI','CLR','SBOW','CRC',
]

NASDAQ100_SYMBOLS = [
    'AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','AVGO','COST','NFLX',
    'AMD','ADBE','QCOM','PEP','TMUS','AMAT','TXN','INTU','MU','LRCX',
    'ISRG','BKNG','KLAC','REGN','PANW','SNPS','CDNS','CRWD','CSX','MELI',
    'ORLY','ABNB','CTAS','FTNT','MDLZ','ROP','MNST','PCAR','ADP','CPRT',
    'ROST','PAYX','KDP','ODFL','MCHP','IDXX','EA','DXCM','TEAM','FAST'
]

DOW30_SYMBOLS = [
    'AAPL','AMGN','AXP','BA','CAT','CRM','CSCO','CVX','DIS','DOW',
    'GS','HD','HON','IBM','JNJ','JPM','KO','MCD','MMM','MRK',
    'MSFT','NKE','PG','TRV','UNH','V','VZ','WBA','WMT','INTC'
]

# 코스피200 주요 종목 (yfinance .KS 형식)
KOSPI200_SYMBOLS = [
    '005930.KS',  # 삼성전자
    '000660.KS',  # SK하이닉스
    '207940.KS',  # 삼성바이오로직스
    '005380.KS',  # 현대차
    '035420.KS',  # NAVER
    '000270.KS',  # 기아
    '068270.KS',  # 셀트리온
    '051910.KS',  # LG화학
    '035720.KS',  # 카카오
    '028260.KS',  # 삼성물산
    '006400.KS',  # 삼성SDI
    '003550.KS',  # LG
    '015760.KS',  # 한국전력
    '086790.KS',  # 하나금융지주
    '055550.KS',  # 신한지주
    '105560.KS',  # KB금융
    '096770.KS',  # SK이노베이션
    '003490.KS',  # 대한항공
    '012330.KS',  # 현대모비스
    '011170.KS',  # 롯데케미칼
    '009150.KS',  # 삼성전기
    '066570.KS',  # LG전자
    '034730.KS',  # SK
    '017670.KS',  # SK텔레콤
    '030200.KS',  # KT
    '018260.KS',  # 삼성에스디에스
    '032830.KS',  # 삼성생명
    '010950.KS',  # S-Oil
    '001570.KS',  # 금양
    '373220.KS',  # LG에너지솔루션
]

# 코스닥150 주요 종목
KOSDAQ150_SYMBOLS = [
    '247540.KQ',  # 에코프로비엠
    '086520.KQ',  # 에코프로
    '035900.KQ',  # JYP엔터
    '041510.KQ',  # SM엔터
    '263750.KQ',  # 펄어비스
    '293490.KQ',  # 카카오게임즈
    '145020.KQ',  # 휴젤
    '112040.KQ',  # 위메이드
    '196170.KQ',  # 알테오젠
    '091990.KQ',  # 셀트리온헬스케어
    '214150.KQ',  # 클래시스
    '039030.KQ',  # 이오테크닉스
    '032640.KQ',  # LG유플러스
    '066970.KQ',  # 엘앤에프
    '096530.KQ',  # 씨젠
    '048410.KQ',  # 현대바이오
    '122870.KQ',  # 와이지엔터테인먼트
    '236340.KQ',  # 뷰노
    '108860.KQ',  # 셀바스AI
    '095340.KQ',  # ISC
]


def get_factor_data(symbol):
    """yfinance로 팩터 데이터 수집 (PER, PBR, ROE, 매출성장률, 시가총액, 모멘텀)
    메모리 캐시 30분 적용 — DB 저장 안 함 (야후 이용약관 준수)
    """
    # 캐시 확인
    cache_key = f'factor:{symbol}'
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Finnhub 교체 분기
    if USE_FINNHUB and _is_us_symbol(symbol):
        return get_factor_data_finnhub(symbol)

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        # 기본 재무 데이터
        per = info.get('trailingPE') or info.get('forwardPE')
        pbr = info.get('priceToBook')
        roe = info.get('returnOnEquity')  # 소수점 (0.15 = 15%)
        market_cap = info.get('marketCap', 0)
        revenue_growth = info.get('revenueGrowth')  # 소수점
        earnings_growth = info.get('earningsGrowth')
        debt_to_equity = info.get('debtToEquity')
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        volume = info.get('averageVolume', 0)
        profit_margins = info.get('profitMargins')

        # 모멘텀: 최근 3개월 수익률 (52주 고점 대비)
        hist = ticker.history(period='1y')
        momentum_3m = None
        momentum_6m = None
        momentum_12m = None
        sma200 = None
        above_sma200 = None
        if not hist.empty and len(hist) >= 60:
            price_now = hist['Close'].iloc[-1]
            price_3m  = hist['Close'].iloc[-63]  if len(hist) >= 63  else hist['Close'].iloc[0]
            price_6m  = hist['Close'].iloc[-126] if len(hist) >= 126 else hist['Close'].iloc[0]
            price_12m = hist['Close'].iloc[-252] if len(hist) >= 252 else hist['Close'].iloc[0]
            momentum_3m  = round((price_now - price_3m)  / price_3m  * 100, 2)
            momentum_6m  = round((price_now - price_6m)  / price_6m  * 100, 2)
            momentum_12m = round((price_now - price_12m) / price_12m * 100, 2)
            # 200일 이동평균 (시장 타이밍 필터)
            if len(hist) >= 200:
                sma200 = round(float(hist['Close'].iloc[-200:].mean()), 2)
                above_sma200 = price_now > sma200  # True면 상승장

        result = {
            'symbol': symbol,
            'per': round(per, 2) if per else None,
            'pbr': round(pbr, 2) if pbr else None,
            'roe': round(roe * 100, 2) if roe else None,
            'market_cap': market_cap,
            'revenue_growth': round(revenue_growth * 100, 2) if revenue_growth else None,
            'earnings_growth': round(earnings_growth * 100, 2) if earnings_growth else None,
            'debt_to_equity': round(debt_to_equity, 2) if debt_to_equity else None,
            'profit_margins': round(profit_margins * 100, 2) if profit_margins else None,
            'momentum_3m': momentum_3m,
            'momentum_6m': momentum_6m,
            'momentum_12m': momentum_12m,
            'sma200': sma200,
            'above_sma200': int(above_sma200) if above_sma200 is not None else None,
            'price': round(current_price, 2) if current_price else None,
            'volume': volume,
            # 뉴스 감성 점수 (보조 지표 20% 가중치)
            **get_news_sentiment(symbol),
        }
        cache_set(cache_key, result)  # 메모리 캐시 저장 (30분)
        return result
    except Exception as e:
        return {'symbol': symbol, 'error': str(e)}


def score_factors(item, strategy, profile_weights=None):
    """
    전략별 팩터 점수 계산
    profile_weights: 투자 성향별 가중치 dict
      { w_momentum, w_value, w_quality, w_news }
      None이면 전략 기본값 사용
    """
    score = 0
    reasons = []

    # 성향 가중치 (없으면 기본값)
    pw = profile_weights or {}
    w_momentum = pw.get('w_momentum', 0.35)
    w_value    = pw.get('w_value',    0.30)
    w_quality  = pw.get('w_quality',  0.25)
    # w_news는 apply_news_adjustment에서 사용

    if strategy == 'value':
        # 저평가 전략: PER↓ PBR↓ ROE↑
        if item.get('per') and item['per'] < 20:
            score += (20 - item['per']) * 0.5
            reasons.append(f"PER {item['per']:.1f} 저평가")
        if item.get('pbr') and item['pbr'] < 3:
            score += (3 - item['pbr']) * 5
            reasons.append(f"PBR {item['pbr']:.2f} 저평가")
        if item.get('roe') and item['roe'] > 10:
            score += item['roe'] * 0.3
            reasons.append(f"ROE {item['roe']:.1f}% 우수")

    elif strategy == 'growth':
        # 성장주 전략: 매출성장↑ 이익성장↑
        if item.get('revenue_growth') and item['revenue_growth'] > 0:
            score += item['revenue_growth'] * 0.5
            reasons.append(f"매출성장 {item['revenue_growth']:.1f}%")
        if item.get('earnings_growth') and item['earnings_growth'] > 0:
            score += item['earnings_growth'] * 0.3
            reasons.append(f"이익성장 {item['earnings_growth']:.1f}%")
        if item.get('roe') and item['roe'] > 15:
            score += item['roe'] * 0.2
            reasons.append(f"ROE {item['roe']:.1f}%")

    elif strategy == 'quality':
        # 퀄리티 전략: ROE↑ 부채비율↓ 이익률↑
        if item.get('roe') and item['roe'] > 0:
            score += item['roe'] * 0.5
            reasons.append(f"ROE {item['roe']:.1f}%")
        if item.get('debt_to_equity') is not None and item['debt_to_equity'] < 100:
            score += (100 - item['debt_to_equity']) * 0.2
            reasons.append(f"부채비율 {item['debt_to_equity']:.0f}% 양호")
        if item.get('profit_margins') and item['profit_margins'] > 10:
            score += item['profit_margins'] * 0.3
            reasons.append(f"순이익률 {item['profit_margins']:.1f}%")

    elif strategy == 'momentum':
        # 모멘텀 전략: 3개월·6개월 수익률↑
        if item.get('momentum_3m') and item['momentum_3m'] > 0:
            score += item['momentum_3m'] * 0.6
            reasons.append(f"3개월 수익률 +{item['momentum_3m']:.1f}%")
        if item.get('momentum_6m') and item['momentum_6m'] > 0:
            score += item['momentum_6m'] * 0.4
            reasons.append(f"6개월 수익률 +{item['momentum_6m']:.1f}%")

    elif strategy == 'momentum_ma':
        # 모멘텀 + 200일 이동평균 전략
        # 1단계: 모멘텀 점수 (6개월·12개월 수익률 상위)
        m6  = item.get('momentum_6m')
        m12 = item.get('momentum_12m')
        if m6 and m6 > 0:
            score += m6 * 0.5
            reasons.append(f"6개월 모멘텀 +{m6:.1f}%")
        if m12 and m12 > 0:
            score += m12 * 0.3
            reasons.append(f"12개월 모멘텀 +{m12:.1f}%")
        # 2단계: 200일선 위에 있어야 매수 (시장 타이밍 필터)
        above = item.get('above_sma200')
        sma200 = item.get('sma200')
        price  = item.get('price')
        if above is True:
            score += 20  # 200일선 위 보너스
            if sma200 and price:
                pct = round((price - sma200) / sma200 * 100, 1)
                reasons.append(f"200일선 위 +{pct}%")
        elif above is False:
            score -= 30  # 200일선 아래 페널티 (하락장)
            reasons.append("⚠️ 200일선 아래 (하락장)")
        # 3단계: 모멘텀 음수면 제외
        if m6 and m6 < 0:
            score -= 20
        if m12 and m12 < 0:
            score -= 10

    elif strategy == 'value_quality':
        # 저평가 + 퀄리티 (추천 조합) — 성향 가중치 반영
        val_w = w_value * 1.5  # 가치 가중치
        qua_w = w_quality * 1.5  # 퀄리티 가중치
        if item.get('per') and 0 < item['per'] < 25:
            score += (25 - item['per']) * 0.4 * (val_w / 0.45)
            reasons.append(f"PER {item['per']:.1f}")
        if item.get('pbr') and 0 < item['pbr'] < 4:
            score += (4 - item['pbr']) * 4 * (val_w / 0.45)
            reasons.append(f"PBR {item['pbr']:.2f}")
        if item.get('roe') and item['roe'] > 10:
            score += item['roe'] * 0.4 * (qua_w / 0.375)
            reasons.append(f"ROE {item['roe']:.1f}%")
        if item.get('debt_to_equity') is not None and item['debt_to_equity'] < 150:
            score += (150 - item['debt_to_equity']) * 0.1 * (qua_w / 0.375)
            reasons.append(f"부채비율 {item['debt_to_equity']:.0f}%")

    # ── 뉴스 감성 보조 지표 공통 반영 (성향별 가중치) ──────────
    score, reasons = apply_news_adjustment(score, item, reasons, pw.get('w_news', 0.10))

    return round(score, 2), reasons


def apply_news_adjustment(score: float, item: dict, reasons: list, w_news: float = 0.10) -> tuple:
    """
    뉴스 감성 점수를 공통 보조 지표로 반영
    w_news: 투자 성향별 뉴스 가중치 (기본 10%, 공격형 15%)
    """
    news_score = item.get('news_score', 0.0) or 0.0
    macro_risk = item.get('macro_risk', 0.0) or 0.0
    news_label = item.get('news_label', '')

    # 뉴스 보조 점수 (성향별 가중치, 최대 ±15점)
    news_multiplier = w_news / 0.10  # 기본 대비 배율
    news_bonus = max(-15, min(15, news_score * 5 * news_multiplier))
    score += news_bonus

    # 거시 악재 차감 (리스크 필터 — 성향 무관 동일 적용)
    macro_penalty = max(-15, macro_risk * 3)
    score += macro_penalty

    # 이유 표시
    if news_label and news_label != '뉴스없음' and news_label != '데이터없음':
        nc = item.get('news_count', 0)
        reasons.append(f"{news_label} ({nc}건)")
    if macro_risk < -1.0:
        reasons.append(f"⚠️ 거시악재")

    return round(score, 2), reasons


def filter_universe(items):
    """1차 필터: 잡주 제거 (시가총액, 적자 기업 등)"""
    filtered = []
    for item in items:
        if item.get('error'):
            continue
        # 시가총액 10억 달러 이상 (약 1.3조원)
        if item.get('market_cap', 0) < 1_000_000_000:
            continue
        # 가격 데이터 없으면 제외
        if not item.get('price'):
            continue
        filtered.append(item)
    return filtered


@app.route('/api/quant/factor-screen', methods=['POST'])
def factor_screen():
    """팩터 기반 퀀트 스크리너 — 나스닥100/다우존스30에서 TOP5 선별"""
    data = request.json or {}
    strategy = data.get('strategy', 'value_quality')
    market = data.get('market', 'nasdaq')
    top_n = int(data.get('top_n', 5))
    # 투자 성향 가중치 (프론트에서 전달)
    profile_weights = data.get('profile_weights', None)

    symbols = DOW30_SYMBOLS if market == 'dow' else NASDAQ100_SYMBOLS if market == 'nasdaq' else SP500_SYMBOLS if market == 'sp500' else RUSSELL1000_SYMBOLS if market == 'russell1000' else KOSDAQ150_SYMBOLS if market == 'kosdaq' else KOSPI200_SYMBOLS

    # 병렬 데이터 수집
    import concurrent.futures
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(get_factor_data, sym): sym for sym in symbols}
        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception:
                pass

    # 1차 필터
    filtered = filter_universe(results)

    # 팩터 점수화
    scored = []
    for item in filtered:
        score, reasons = score_factors(item, strategy, profile_weights)
        if score > 0:
            scored.append({**item, 'factor_score': score, 'reasons': reasons})

    # 랭킹 정렬 → TOP N
    scored.sort(key=lambda x: x['factor_score'], reverse=True)
    top = scored[:top_n]

    strategy_labels = {
        'value': '가치주 (저PER·저PBR·고ROE)',
        'growth': '성장주 (매출·이익 성장)',
        'quality': '퀄리티 (고ROE·저부채·고이익률)',
        'momentum': '모멘텀 (3·6개월 수익률)',
        'momentum_ma': '모멘텀+200일선 (종목선택+타이밍 필터)',
        'value_quality': '저평가+퀄리티 (추천 조합)',
    }

    return jsonify({
        'ok': True,
        'strategy': strategy,
        'strategy_label': strategy_labels.get(strategy, strategy),
        'market': market,
        'market_label': '다우존스30' if market == 'dow' else '코스피200' if market == 'kospi' else '코스닥150' if market == 'kosdaq' else '나스닥100',
        'screened': len(filtered),
        'top': top,
        'updated_at': datetime.now().isoformat()
    })


@app.route('/api/quant/integrated-screen', methods=['POST'])
def integrated_screen():
    import concurrent.futures
    data = request.json or {}
    strategy = data.get('strategy', 'value_quality')
    market   = data.get('market', 'nasdaq')
    top_n    = int(data.get('top_n', 10))
    final_n  = int(data.get('final_n', 5))
    symbols  = DOW30_SYMBOLS if market == 'dow' else NASDAQ100_SYMBOLS if market == 'nasdaq' else SP500_SYMBOLS if market == 'sp500' else RUSSELL1000_SYMBOLS if market == 'russell1000' else KOSDAQ150_SYMBOLS if market == 'kosdaq' else KOSPI200_SYMBOLS
    factor_results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(get_factor_data, sym): sym for sym in symbols}
        for future in concurrent.futures.as_completed(futures):
            try: factor_results.append(future.result())
            except: pass
    filtered = filter_universe(factor_results)
    scored = []
    for item in filtered:
        score, reasons = score_factors(item, strategy)
        if score > 0:
            scored.append({**item, 'factor_score': score, 'factor_reasons': reasons})
    scored.sort(key=lambda x: x['factor_score'], reverse=True)
    top_by_factor = scored[:top_n]
    final = []
    for item in top_by_factor:
        tech = analyze_combined(item['symbol'])
        signal = tech.get('signal', 'hold')
        details = tech.get('details', {})
        rsi_val = details.get('RSI', {}).get('value')
        macd_val = details.get('MACD', {}).get('value')
        if signal in ('buy', 'weak_buy'): timing, tcolor, ticon = 'BUY', '#10b981', '🟢'
        elif signal == 'hold': timing, tcolor, ticon = 'WATCH', '#f59e0b', '🟡'
        else: timing, tcolor, ticon = 'AVOID', '#ef4444', '🔴'
        tech_reasons = [r for r in [f"RSI {rsi_val:.1f}" if rsi_val else '', f"MACD {macd_val:.3f}" if macd_val else '', details.get('RSI', {}).get('reason', '')] if r]
        final.append({**item, 'timing': timing, 'timing_color': tcolor, 'timing_icon': ticon, 'tech_signal': signal, 'tech_score': tech.get('score', 0), 'tech_reasons': tech_reasons, 'combined_score': round(item['factor_score'] + tech.get('score', 0) * 10, 2)})
    order_map = {'BUY': 0, 'WATCH': 1, 'AVOID': 2}
    final.sort(key=lambda x: (order_map.get(x['timing'], 1), -x['combined_score']))
    final = final[:final_n]
    strategy_labels = {'value': '가치주', 'growth': '성장주', 'quality': '퀄리티', 'momentum': '모멘텀', 'momentum_ma': '모멘텀+200일선', 'value_quality': '저평가+퀄리티'}
    market_labels = {'nasdaq': '나스닥100', 'dow': '다우존스30', 'sp500': 'S&P500', 'russell1000': 'Russell1000', 'kospi': '코스피200', 'kosdaq': '코스닥150'}
    return jsonify({'ok': True, 'strategy': strategy, 'strategy_label': strategy_labels.get(strategy, strategy), 'market': market, 'market_label': market_labels.get(market, market), 'screened': len(filtered), 'factor_top': top_n, 'results': final, 'updated_at': datetime.now().isoformat()})


@app.route('/api/quant/stock-analysis', methods=['GET'])
def stock_analysis():
    symbol = request.args.get('symbol', '').strip().upper()
    if not symbol:
        return jsonify({'ok': False, 'error': '종목 심볼을 입력해주세요'})
    try:
        # Finnhub 분기 (미국 주식만)
        if USE_FINNHUB and _is_us_symbol(symbol):
            result = get_stock_analysis_finnhub(symbol)
            tech = analyze_combined(symbol)
            result['technical'] = tech
            result['updated_at'] = datetime.now().isoformat()
            return jsonify(result)

        # yfinance (한국 주식 또는 USE_FINNHUB=False)
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.info

        current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
        prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose')
        change_pct = round(((current_price - prev_close) / prev_close * 100), 2) if current_price and prev_close else None

        consensus = {
            'target_mean': info.get('targetMeanPrice'),
            'target_high': info.get('targetHighPrice'),
            'target_low': info.get('targetLowPrice'),
            'recommendation': info.get('recommendationKey'),
            'analyst_count': info.get('numberOfAnalystOpinions'),
            'upside_pct': round((info.get('targetMeanPrice', 0) - current_price) / current_price * 100, 2) if current_price and info.get('targetMeanPrice') else None
        }

        fundamentals = {
            'per': round(info.get('trailingPE', 0), 2) if info.get('trailingPE') else None,
            'pbr': round(info.get('priceToBook', 0), 2) if info.get('priceToBook') else None,
            'roe': round(info.get('returnOnEquity', 0) * 100, 2) if info.get('returnOnEquity') else None,
            'debt_to_equity': round(info.get('debtToEquity', 0), 2) if info.get('debtToEquity') else None,
            'revenue_growth': round(info.get('revenueGrowth', 0) * 100, 2) if info.get('revenueGrowth') else None,
            'market_cap': info.get('marketCap'),
            'volume': info.get('regularMarketVolume') or info.get('volume'),
            'avg_volume': info.get('averageVolume'),
            'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
            'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
            'name': info.get('longName') or info.get('shortName', symbol),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
        }

        tech = analyze_combined(symbol)

        return jsonify({
            'ok': True,
            'symbol': symbol,
            'current_price': current_price,
            'prev_close': prev_close,
            'change_pct': change_pct,
            'consensus': consensus,
            'fundamentals': fundamentals,
            'technical': tech,
            'updated_at': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})



if __name__ == '__main__':
    # 만료 캐시 자동 정리 (10분마다)
    def _cache_cleaner():
        while True:
            time.sleep(600)
            cache_clear_expired()
    threading.Thread(target=_cache_cleaner, daemon=True).start()
    print("🚀 퀀트 엔진 시작 (포트 5002)")
    print(f"   yfinance: {'✅' if YFINANCE_OK else '❌'}")
    print(f"   pykrx:    {'✅' if PYKRX_OK else '❌'}")
    print(f"   alpaca:   {'✅' if ALPACA_OK else '❌'}")
    # 외부 노출 금지: Node 대시보드(localhost)에서만 접근.
    # 별도 호스트에 띄우려면 PYTHON_HOST=0.0.0.0 + 방화벽 + INTERNAL_API_TOKEN 필수.
    _host = os.environ.get('PYTHON_HOST', '127.0.0.1')
    _port = int(os.environ.get('QUANT_PORT', '5002'))
    app.run(host=_host, port=_port, debug=False)
    
