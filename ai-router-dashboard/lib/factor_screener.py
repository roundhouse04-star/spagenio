"""
factor_screener.py — 팩터 기반 퀀트 스크리너 (helpers).
quant_engine.py 에서 분리. Flask 라우트는 quant_engine.py 에 잔존.

함수:
- get_factor_data: yfinance 로 PER/PBR/ROE/모멘텀 등 팩터 수집 (캐시 30분)
- score_factors: 전략(value/growth/quality/momentum/momentum_ma/value_quality)별 점수 계산
- apply_news_adjustment: 뉴스 감성 보조 점수 반영
- filter_universe: 잡주 제거 (시가총액/가격 기준)
"""
from .quant_cache import cache_get, cache_set
from .quant_data import USE_FINNHUB, _is_us_symbol, get_factor_data_finnhub, YFINANCE_OK
from .quant_news import get_news_sentiment

if YFINANCE_OK:
    import yfinance as yf
else:
    yf = None


def get_factor_data(symbol):
    """yfinance 로 팩터 데이터 수집 (PER, PBR, ROE, 매출성장률, 시가총액, 모멘텀).
    메모리 캐시 30분 적용 — DB 저장 안 함 (야후 이용약관 준수)."""
    cache_key = f'factor:{symbol}'
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Finnhub 교체 분기
    if USE_FINNHUB and _is_us_symbol(symbol):
        return get_factor_data_finnhub(symbol)

    if not YFINANCE_OK:
        return {'symbol': symbol, 'error': 'yfinance 미설치'}

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        # 기본 재무 데이터
        per = info.get('trailingPE') or info.get('forwardPE')
        pbr = info.get('priceToBook')
        roe = info.get('returnOnEquity')  # 소수점 (0.15 = 15%)
        market_cap = info.get('marketCap', 0)
        revenue_growth = info.get('revenueGrowth')
        earnings_growth = info.get('earningsGrowth')
        debt_to_equity = info.get('debtToEquity')
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        volume = info.get('averageVolume', 0)
        profit_margins = info.get('profitMargins')

        # 모멘텀: 최근 3/6/12개월 수익률 + 200일 SMA
        hist = ticker.history(period='1y')
        momentum_3m = momentum_6m = momentum_12m = sma200 = above_sma200 = None
        if not hist.empty and len(hist) >= 60:
            price_now = hist['Close'].iloc[-1]
            price_3m  = hist['Close'].iloc[-63]  if len(hist) >= 63  else hist['Close'].iloc[0]
            price_6m  = hist['Close'].iloc[-126] if len(hist) >= 126 else hist['Close'].iloc[0]
            price_12m = hist['Close'].iloc[-252] if len(hist) >= 252 else hist['Close'].iloc[0]
            momentum_3m  = round((price_now - price_3m)  / price_3m  * 100, 2)
            momentum_6m  = round((price_now - price_6m)  / price_6m  * 100, 2)
            momentum_12m = round((price_now - price_12m) / price_12m * 100, 2)
            if len(hist) >= 200:
                sma200 = round(float(hist['Close'].iloc[-200:].mean()), 2)
                above_sma200 = price_now > sma200

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
            # 뉴스 감성 점수 (보조 지표 가중치)
            **get_news_sentiment(symbol),
        }
        cache_set(cache_key, result)
        return result
    except Exception as e:
        return {'symbol': symbol, 'error': str(e)}


def apply_news_adjustment(score: float, item: dict, reasons: list, w_news: float = 0.10):
    """뉴스 감성 점수를 공통 보조 지표로 반영.
    w_news: 투자 성향별 뉴스 가중치 (기본 10%, 공격형 15%)."""
    news_score = item.get('news_score', 0.0) or 0.0
    macro_risk = item.get('macro_risk', 0.0) or 0.0
    news_label = item.get('news_label', '')

    # 뉴스 보조 점수 (성향별 가중치, 최대 ±15점)
    news_multiplier = w_news / 0.10
    news_bonus = max(-15, min(15, news_score * 5 * news_multiplier))
    score += news_bonus

    # 거시 악재 차감 (리스크 필터 — 성향 무관 동일 적용)
    macro_penalty = max(-15, macro_risk * 3)
    score += macro_penalty

    if news_label and news_label != '뉴스없음' and news_label != '데이터없음':
        nc = item.get('news_count', 0)
        reasons.append(f"{news_label} ({nc}건)")
    if macro_risk < -1.0:
        reasons.append(f"⚠️ 거시악재")

    return round(score, 2), reasons


def score_factors(item, strategy, profile_weights=None):
    """전략별 팩터 점수 계산.
    profile_weights: 투자 성향별 가중치 dict { w_momentum, w_value, w_quality, w_news }."""
    score = 0
    reasons = []

    pw = profile_weights or {}
    w_momentum = pw.get('w_momentum', 0.35)
    w_value    = pw.get('w_value',    0.30)
    w_quality  = pw.get('w_quality',  0.25)

    if strategy == 'value':
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
        if item.get('momentum_3m') and item['momentum_3m'] > 0:
            score += item['momentum_3m'] * 0.6
            reasons.append(f"3개월 수익률 +{item['momentum_3m']:.1f}%")
        if item.get('momentum_6m') and item['momentum_6m'] > 0:
            score += item['momentum_6m'] * 0.4
            reasons.append(f"6개월 수익률 +{item['momentum_6m']:.1f}%")

    elif strategy == 'momentum_ma':
        m6  = item.get('momentum_6m')
        m12 = item.get('momentum_12m')
        if m6 and m6 > 0:
            score += m6 * 0.5
            reasons.append(f"6개월 모멘텀 +{m6:.1f}%")
        if m12 and m12 > 0:
            score += m12 * 0.3
            reasons.append(f"12개월 모멘텀 +{m12:.1f}%")
        above = item.get('above_sma200')
        sma200 = item.get('sma200')
        price  = item.get('price')
        if above is True:
            score += 20
            if sma200 and price:
                pct = round((price - sma200) / sma200 * 100, 1)
                reasons.append(f"200일선 위 +{pct}%")
        elif above is False:
            score -= 30
            reasons.append("⚠️ 200일선 아래 (하락장)")
        if m6 and m6 < 0:
            score -= 20
        if m12 and m12 < 0:
            score -= 10

    elif strategy == 'value_quality':
        val_w = w_value * 1.5
        qua_w = w_quality * 1.5
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

    # ── 뉴스 감성 보조 지표 공통 반영 (성향별 가중치) ──
    score, reasons = apply_news_adjustment(score, item, reasons, pw.get('w_news', 0.10))

    return round(score, 2), reasons


def filter_universe(items):
    """1차 필터: 잡주 제거 (시가총액 10억 달러 이상, 가격 데이터 있는 종목만)."""
    filtered = []
    for item in items:
        if item.get('error'):
            continue
        if item.get('market_cap', 0) < 1_000_000_000:
            continue
        if not item.get('price'):
            continue
        filtered.append(item)
    return filtered
