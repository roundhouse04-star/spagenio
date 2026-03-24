"""
quant_engine.py
퀀트 분석 엔진 - pandas_ta 없이 직접 구현
기존 stock_server.py와 통합되어 포트 5001에서 실행
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
DB_PATH = os.path.join(os.path.dirname(__file__), 'news.db')

app = Flask(__name__)
CORS(app)

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

    conn.commit()
    conn.close()
    print("✅ 퀀트 DB 초기화 완료")

init_quant_db()

# ===== 퀀트 지표 직접 계산 (pandas_ta 없이) =====

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
    """MACD"""
    if len(closes) < slow + signal:
        return None, None
    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)
    if ema_fast is None or ema_slow is None:
        return None, None
    macd_line = round(ema_fast - ema_slow, 4)
    return macd_line, None


def get_stock_data(symbol, period_days=60):
    """yfinance로 주가 데이터 가져오기"""
    if not YFINANCE_OK:
        return None
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=f"{period_days}d")
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
    """MACD 전략"""
    data = get_stock_data(symbol)
    if not data:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 없음'}

    macd, signal_line = calc_macd(data['closes'])
    if macd is None:
        return {'signal': 'hold', 'value': None, 'reason': '데이터 부족'}

    if macd > 0:
        signal = 'buy'
        reason = f'MACD {macd} > 0 (상승 모멘텀)'
    elif macd < 0:
        signal = 'sell'
        reason = f'MACD {macd} < 0 (하락 모멘텀)'
    else:
        signal = 'hold'
        reason = 'MACD 중립'

    return {
        'signal': signal,
        'value': macd,
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
        results = []
        for idx, item in enumerate(items):
            ticker = item.get('ticker', '')
            name = item.get('name', '')
            price = item.get('price', 0)
            volume = item.get('volume', 0)

            # 거래량 순위 점수 (0~50)
            vol_score = (20 - idx) / 20 * 50

            # RSI 보너스 (yfinance로 한국 주식)
            rsi_score = 0
            try:
                if ticker:
                    kr_symbol = ticker + '.KS'
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

@app.route('/api/quant/analyze', methods=['POST'])
def analyze():
    """단일 종목 퀀트 분석"""
    data = request.json
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
    data = request.json
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
def trade():
    """퀀트 신호 기반 매매 실행"""
    data = request.json
    symbol = data.get('symbol')
    signal = data.get('signal')  # buy or sell
    strategy = data.get('strategy', 'manual')
    qty = int(data.get('qty', 1))

    if not symbol or signal not in ['buy', 'sell']:
        return jsonify({'error': '종목 또는 신호 오류'}), 400

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
def auto_trade():
    """자동매매 - 분석 후 신호에 따라 자동 주문"""
    data = request.json
    symbol = data.get('symbol', 'QQQ')
    strategy = data.get('strategy', 'combined')
    qty = int(data.get('qty', 1))
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
    """종목 차트 데이터 (주가 + 거래량 + RSI + BB + MACD)"""
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

        # RSI
        try:
            rsi_vals = calc_rsi(closes, 14)
        except:
            rsi_vals = [None] * len(closes)

        # 볼린저 밴드
        try:
            bb = calc_bollinger(closes, 20)
            bb_upper = bb['upper']
            bb_lower = bb['lower']
            bb_mid   = bb['middle']
        except:
            bb_upper = bb_lower = bb_mid = [None] * len(closes)

        # MACD
        try:
            macd_data = calc_macd(closes)
            macd_line = macd_data['macd']
            signal_line = macd_data['signal']
            macd_hist  = macd_data['histogram']
        except:
            macd_line = signal_line = macd_hist = [None] * len(closes)

        # SMA 20, 50
        sma20 = [None]*(19) + [sum(closes[i-20:i])/20 for i in range(20, len(closes)+1)]
        sma50 = [None]*(49) + [sum(closes[i-50:i])/50 for i in range(50, len(closes)+1)] if len(closes) >= 50 else [None]*len(closes)

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


if __name__ == '__main__':
    print("🚀 퀀트 엔진 시작 (포트 5002)")
    print(f"   yfinance: {'✅' if YFINANCE_OK else '❌'}")
    print(f"   pykrx:    {'✅' if PYKRX_OK else '❌'}")
    print(f"   alpaca:   {'✅' if ALPACA_OK else '❌'}")
    app.run(host='0.0.0.0', port=5002, debug=False)

