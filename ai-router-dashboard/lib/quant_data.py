"""
quant_data.py — 주가 데이터 레이어 (yfinance + Finnhub).
quant_engine.py 에서 분리.

설계:
- USE_FINNHUB 플래그로 미국 주식만 Finnhub 으로 분기 (한국 주식은 yfinance/pykrx 유지)
- get_stock_data 가 메인 진입점 — 내부에서 분기
"""
import os
import time as _time
import requests as _requests
from datetime import datetime as _dt


# Finnhub 설정 (상업적 사용 가능)
FINNHUB_API_KEY = os.environ.get('FINNHUB_API_KEY', '')
FINNHUB_BASE = 'https://finnhub.io/api/v1'
USE_FINNHUB = False  # True 로 바꾸면 미국 주식 데이터를 Finnhub 으로 조회

# yfinance lazy load
try:
    import yfinance as yf
    YFINANCE_OK = True
except Exception:
    yf = None
    YFINANCE_OK = False


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
    dates = [_dt.fromtimestamp(t).strftime('%Y-%m-%d') for t in timestamps]
    return {
        'closes': closes,
        'volumes': volumes,
        'last_price': round(float(closes[-1]), 2),
        'dates': dates
    }


def get_factor_data_finnhub(symbol):
    """Finnhub으로 팩터 데이터 가져오기 (yfinance 대체)"""
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
    roe = m.get('roeTTM')
    debt_to_equity = m.get('totalDebt/totalEquityAnnual')
    revenue_growth = m.get('revenueGrowthTTMYoy')
    market_cap = profile.get('marketCapitalization', 0) * 1e6 if profile.get('marketCapitalization') else 0

    return {
        'symbol': symbol,
        'per': round(per, 2) if per else None,
        'pbr': round(pbr, 2) if pbr else None,
        'roe': round(roe, 4) if roe else None,
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
    quote = _finnhub_get('/quote', {'symbol': symbol})
    profile = _finnhub_get('/stock/profile2', {'symbol': symbol})
    metrics = _finnhub_get('/stock/metric', {'symbol': symbol, 'metric': 'all'})
    target = _finnhub_get('/stock/price-target', {'symbol': symbol})
    rec_list = _finnhub_get('/stock/recommendation', {'symbol': symbol})
    rec = rec_list[0] if rec_list else {}

    m = metrics.get('metric', {})
    current_price = quote.get('c')
    prev_close = quote.get('pc')
    change_pct = round((current_price - prev_close) / prev_close * 100, 2) if current_price and prev_close else None

    target_mean = target.get('targetMean')
    upside_pct = round((target_mean - current_price) / current_price * 100, 2) if target_mean and current_price else None

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


def get_stock_data(symbol, period_days=60):
    """주가 데이터 가져오기 (USE_FINNHUB=True 시 Finnhub, 기본 yfinance)"""
    if USE_FINNHUB and _is_us_symbol(symbol):
        return get_stock_data_finnhub(symbol, period_days)
    if not YFINANCE_OK:
        return None
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=f"{period_days}d")
        if hist.empty:
            return None
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
