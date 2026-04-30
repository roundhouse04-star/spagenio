"""
quant_strategies.py — 퀀트 전략 분석 (analyze_*).
quant_engine.py 에서 분리.

각 전략은 symbol → {signal, value, price, reason} 반환.
analyze_combined 은 4개 전략 가중치 합산.
"""
import os
import sqlite3
from .quant_indicators import calc_rsi, calc_sma, calc_bollinger_bands, calc_macd
from .quant_data import get_stock_data


DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'stock.db')


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
    """MACD 전략 — 표준: MACD line vs signal line 크로스오버."""
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
    """분석 결과 DB 저장 (quant_analysis 테이블)"""
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
