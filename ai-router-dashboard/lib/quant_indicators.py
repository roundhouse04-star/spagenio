"""
quant_indicators.py — 퀀트 지표 계산 (pandas_ta 의존 X, 순수 Python).
quant_engine.py 에서 분리 (모놀리식 정리).

함수:
  · scalar (latest 값): calc_rsi, calc_sma, calc_ema, calc_bollinger_bands, calc_macd
  · 시계열 (길이 = len(closes), warmup 구간 None): calc_rsi_series, calc_bollinger_series, calc_macd_series
"""
import math


def calc_rsi(closes, period=14):
    """RSI 계산"""
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0 for d in deltas]
    losses = [-d if d < 0 else 0 for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def calc_sma(closes, period):
    """단순이동평균"""
    if len(closes) < period:
        return None
    return round(sum(closes[-period:]) / period, 4)


def calc_ema(closes, period):
    """지수이동평균"""
    if len(closes) < period:
        return None
    k = 2 / (period + 1)
    ema = sum(closes[:period]) / period
    for price in closes[period:]:
        ema = price * k + ema * (1 - k)
    return round(ema, 4)


def calc_bollinger_bands(closes, period=20, std_dev=2):
    """볼린저 밴드"""
    if len(closes) < period:
        return None, None, None
    recent = closes[-period:]
    sma = sum(recent) / period
    variance = sum((x - sma) ** 2 for x in recent) / period
    std = math.sqrt(variance)
    upper = round(sma + std_dev * std, 4)
    lower = round(sma - std_dev * std, 4)
    return round(upper, 4), round(sma, 4), round(lower, 4)


def calc_macd(closes, fast=12, slow=26, signal=9):
    """MACD (latest 값만). signal line 까지 계산하고 (macd, signal) 반환."""
    if len(closes) < slow + signal:
        return None, None
    macd_arr, sig_arr, _ = calc_macd_series(closes, fast=fast, slow=slow, signal=signal)
    macd_last = next((v for v in reversed(macd_arr) if v is not None), None)
    sig_last  = next((v for v in reversed(sig_arr)  if v is not None), None)
    return macd_last, sig_last


# ─────────────────────────────────────────────────────────────
# 시계열 버전 (차트 endpoint 용 — 길이 = len(closes), warmup 구간은 None)
# ─────────────────────────────────────────────────────────────
def calc_rsi_series(closes, period=14):
    """Wilder smoothing RSI 시계열. 처음 period 개는 None."""
    n = len(closes)
    out = [None] * n
    if n < period + 1:
        return out
    deltas = [closes[i] - closes[i - 1] for i in range(1, n)]
    gains  = [d if d > 0 else 0 for d in deltas]
    losses = [-d if d < 0 else 0 for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    out[period] = 100.0 if avg_loss == 0 else round(100 - 100 / (1 + avg_gain / avg_loss), 2)
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        out[i + 1] = 100.0 if avg_loss == 0 else round(100 - 100 / (1 + avg_gain / avg_loss), 2)
    return out


def calc_bollinger_series(closes, period=20, std_dev=2):
    """볼린저 밴드 시계열 (upper, middle, lower). 길이 = len(closes)."""
    n = len(closes)
    upper  = [None] * n
    middle = [None] * n
    lower  = [None] * n
    if n < period:
        return upper, middle, lower
    for i in range(period - 1, n):
        window = closes[i - period + 1:i + 1]
        sma = sum(window) / period
        var = sum((x - sma) ** 2 for x in window) / period
        std = math.sqrt(var)
        upper[i]  = round(sma + std_dev * std, 4)
        middle[i] = round(sma, 4)
        lower[i]  = round(sma - std_dev * std, 4)
    return upper, middle, lower


def _ema_series(closes, period):
    """EMA 시계열. 처음 period-1 개는 None, period 번째는 SMA seed."""
    n = len(closes)
    out = [None] * n
    if n < period:
        return out
    k = 2 / (period + 1)
    seed = sum(closes[:period]) / period
    out[period - 1] = seed
    ema = seed
    for i in range(period, n):
        ema = closes[i] * k + ema * (1 - k)
        out[i] = ema
    return out


def calc_macd_series(closes, fast=12, slow=26, signal=9):
    """MACD 시계열 (macd_line, signal_line, histogram). 표준 구현 (signal = MACD 의 9-EMA)."""
    n = len(closes)
    macd_line   = [None] * n
    signal_line = [None] * n
    histogram   = [None] * n
    if n < slow + signal:
        return macd_line, signal_line, histogram
    ef = _ema_series(closes, fast)
    es = _ema_series(closes, slow)
    macd_vals = []
    macd_idx  = []
    for i in range(n):
        if ef[i] is not None and es[i] is not None:
            macd_line[i] = round(ef[i] - es[i], 4)
            macd_vals.append(macd_line[i])
            macd_idx.append(i)
    if len(macd_vals) < signal:
        return macd_line, signal_line, histogram
    sig_seed = sum(macd_vals[:signal]) / signal
    first_sig_idx = macd_idx[signal - 1]
    signal_line[first_sig_idx] = round(sig_seed, 4)
    histogram[first_sig_idx]   = round(macd_line[first_sig_idx] - sig_seed, 4)
    k = 2 / (signal + 1)
    sig_ema = sig_seed
    for j in range(signal, len(macd_vals)):
        sig_ema = macd_vals[j] * k + sig_ema * (1 - k)
        idx = macd_idx[j]
        signal_line[idx] = round(sig_ema, 4)
        histogram[idx]   = round(macd_line[idx] - sig_ema, 4)
    return macd_line, signal_line, histogram
