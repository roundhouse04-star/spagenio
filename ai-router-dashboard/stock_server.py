from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
from datetime import datetime
import os
import requests as _req

# ============================================================
# FINNHUB 설정 (상업적 사용 가능 - yfinance 대체용)
# 전환 방법:
#   1. https://finnhub.io/register 에서 무료 API 키 발급
#   2. .env 파일에 FINNHUB_API_KEY=your_key 추가
#   3. USE_FINNHUB = True 로 변경
# 전환 범위: 미국 주식 현재가, 복수 시세, 시장 지표, 히스토리 DB
# 한국 주식(.KS/.KQ)은 yfinance 유지
# ============================================================
FINNHUB_API_KEY = os.environ.get('FINNHUB_API_KEY', '')
FINNHUB_BASE = 'https://finnhub.io/api/v1'
USE_FINNHUB = False  # ← True 로 바꾸면 Finnhub 사용

def _fh(endpoint, params={}):
    """Finnhub API 공통 호출"""
    try:
        res = _req.get(f'{FINNHUB_BASE}{endpoint}',
                       params={**params, 'token': FINNHUB_API_KEY}, timeout=10)
        return res.json() if res.status_code == 200 else {}
    except Exception as e:
        print(f'[Finnhub] 오류: {e}')
        return {}

def _is_us(symbol):
    """미국 주식 여부 판단"""
    return not (symbol.endswith('.KS') or symbol.endswith('.KQ'))

def _fh_price(symbol):
    """Finnhub 단일 종목 현재가 조회"""
    q = _fh('/quote', {'symbol': symbol})
    p = _fh('/stock/profile2', {'symbol': symbol})
    price = q.get('c')
    prev  = q.get('pc')
    if not price:
        return None
    change     = round(price - prev, 2) if prev else 0
    change_pct = round((change / prev) * 100, 2) if prev else 0
    return {
        'symbol':     symbol,
        'name':       p.get('name', symbol),
        'price':      round(price, 2),
        'open':       round(q.get('o', price), 2),
        'change':     change,
        'change_pct': change_pct,
        'volume':     int(q.get('v', 0)),
        'currency':   'USD',
        'timestamp':  datetime.now().isoformat()
    }

def _fh_history(symbol, period='2y'):
    """Finnhub 주가 히스토리 DB 저장용 (fetch_and_save_history 대체)"""
    import time as _time
    days = 730 if '2y' in period else 365
    end   = int(_time.time())
    start = end - days * 24 * 3600
    data  = _fh('/stock/candle', {'symbol': symbol, 'resolution': 'D', 'from': start, 'to': end})
    if not data or data.get('s') != 'ok':
        return []
    rows = []
    for i, t in enumerate(data.get('t', [])):
        from datetime import datetime as _dt
        date_str = _dt.fromtimestamp(t).strftime('%Y-%m-%d')
        rows.append({
            'date':   date_str,
            'open':   round(data['o'][i], 4),
            'high':   round(data['h'][i], 4),
            'low':    round(data['l'][i], 4),
            'close':  round(data['c'][i], 4),
            'volume': int(data['v'][i]),
        })
    return rows
import urllib.parse

try:
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
    ALPACA_AVAILABLE = True
except ImportError:
    ALPACA_AVAILABLE = False

app = Flask(__name__)

# CORS: 대시보드(Express) origin만 허용. 환경변수로 override 가능.
# 기본: http://localhost:3000  /  여러 개는 콤마로 분리
_cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGIN', 'http://localhost:3000').split(',') if o.strip()]
CORS(app, origins=_cors_origins)

# Alpaca 자격증명: 반드시 환경변수에서만 로드. 하드코딩 금지.
ALPACA_API_KEY    = os.environ.get('ALPACA_API_KEY', '')
ALPACA_SECRET_KEY = os.environ.get('ALPACA_SECRET_KEY', '')
ALPACA_PAPER      = os.environ.get('ALPACA_PAPER', 'true').lower() == 'true'

# 내부 호출 토큰 (Node 대시보드 → Python 서비스). 비어있으면 mutating 엔드포인트 차단.
INTERNAL_API_TOKEN = os.environ.get('INTERNAL_API_TOKEN', '')

# 1회 주문 최대 수량 한도 (사고 방지). 환경변수로 조정.
MAX_ORDER_QTY = int(os.environ.get('MAX_ORDER_QTY', '10'))


def get_alpaca_client():
    if not ALPACA_AVAILABLE:
        return None
    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        return None
    return TradingClient(ALPACA_API_KEY, ALPACA_SECRET_KEY, paper=ALPACA_PAPER)


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

@app.route('/api/stock/price', methods=['GET'])
def get_price():
    symbol = request.args.get('symbol', 'AAPL')
    # 30분 캐시 확인
    cached = _price_cache.get(symbol)
    if cached and time.time() - cached['ts'] < 1800:
        return jsonify(cached['data'])
    try:
        # Finnhub 분기 (미국 주식만)
        if USE_FINNHUB and _is_us(symbol):
            result = _fh_price(symbol)
            if result:
                _price_cache[symbol] = {'data': result, 'ts': time.time()}
                return jsonify(result)
            return jsonify({'error': f'{symbol} 데이터 없음'}), 404
        # yfinance (한국 주식 또는 USE_FINNHUB=False)
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period='1d')
        if hist.empty:
            return jsonify({'error': f'{symbol} 데이터 없음'}), 404
        current_price = hist['Close'].iloc[-1]
        open_price = hist['Open'].iloc[-1]
        change = current_price - open_price
        change_pct = (change / open_price) * 100
        result = {
            'symbol': symbol,
            'name': info.get('longName', symbol),
            'price': round(current_price, 2),
            'open': round(open_price, 2),
            'change': round(change, 2),
            'change_pct': round(change_pct, 2),
            'volume': int(hist['Volume'].iloc[-1]),
            'currency': info.get('currency', 'USD'),
            'timestamp': datetime.now().isoformat()
        }
        _price_cache[symbol] = {'data': result, 'ts': time.time()}
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/prices', methods=['GET'])
def get_prices():
    symbols = request.args.get('symbols', 'AAPL,MSFT,GOOGL,NVDA,TSLA')
    # 30분 캐시 확인
    cached = _prices_cache.get(symbols)
    if cached and time.time() - cached['ts'] < 1800:
        return jsonify(cached['data'])
    symbol_list = [s.strip() for s in symbols.split(',')]
    results = []
    for symbol in symbol_list:
        try:
            # Finnhub 분기 (미국 주식만)
            if USE_FINNHUB and _is_us(symbol):
                r = _fh_price(symbol)
                if r:
                    results.append({'symbol': symbol, 'price': r['price'],
                                    'change': r['change'], 'change_pct': r['change_pct']})
                else:
                    results.append({'symbol': symbol, 'error': '조회 실패'})
                continue
            # yfinance
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period='1d')
            if not hist.empty:
                current_price = hist['Close'].iloc[-1]
                open_price = hist['Open'].iloc[-1]
                change = current_price - open_price
                change_pct = (change / open_price) * 100
                results.append({
                    'symbol': symbol,
                    'price': round(current_price, 2),
                    'change': round(change, 2),
                    'change_pct': round(change_pct, 2),
                })
        except:
            results.append({'symbol': symbol, 'error': '조회 실패'})
    resp = {'stocks': results, 'timestamp': datetime.now().isoformat()}
    _prices_cache[symbols] = {'data': resp, 'ts': time.time()}
    return jsonify(resp)


@app.route('/api/alpaca/account', methods=['GET'])
def get_account():
    try:
        api = get_alpaca_client()
        account = api.get_account()
        return jsonify({
            'cash': float(account.cash),
            'portfolio_value': float(account.portfolio_value),
            'buying_power': float(account.buying_power),
            'equity': float(account.equity),
            'status': str(account.status)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alpaca/positions', methods=['GET'])
def get_positions():
    try:
        api = get_alpaca_client()
        positions = api.get_all_positions()
        result = []
        for p in positions:
            result.append({
                'symbol': p.symbol,
                'qty': float(p.qty),
                'avg_entry_price': float(p.avg_entry_price),
                'current_price': float(p.current_price),
                'market_value': float(p.market_value),
                'unrealized_pl': float(p.unrealized_pl),
                'unrealized_plpc': round(float(p.unrealized_plpc) * 100, 2)
            })
        return jsonify({'positions': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alpaca/buy', methods=['POST'])
@require_internal_token
def buy_stock():
    data = request.get_json(silent=True) or {}
    symbol = (data.get('symbol') or '').strip().upper()
    try:
        qty = int(data.get('qty', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'qty must be integer'}), 400
    if not symbol:
        return jsonify({'error': 'symbol required'}), 400
    if qty <= 0 or qty > MAX_ORDER_QTY:
        return jsonify({'error': f'qty out of range (1..{MAX_ORDER_QTY})'}), 400
    api = get_alpaca_client()
    if not api:
        return jsonify({'error': 'Alpaca client not configured'}), 503
    try:
        order_data = MarketOrderRequest(symbol=symbol, qty=qty, side=OrderSide.BUY, time_in_force=TimeInForce.GTC)
        order = api.submit_order(order_data)
        return jsonify({'status': 'success', 'order_id': str(order.id), 'symbol': symbol, 'qty': qty, 'side': 'buy'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alpaca/sell', methods=['POST'])
@require_internal_token
def sell_stock():
    data = request.get_json(silent=True) or {}
    symbol = (data.get('symbol') or '').strip().upper()
    try:
        qty = int(data.get('qty', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'qty must be integer'}), 400
    if not symbol:
        return jsonify({'error': 'symbol required'}), 400
    if qty <= 0 or qty > MAX_ORDER_QTY:
        return jsonify({'error': f'qty out of range (1..{MAX_ORDER_QTY})'}), 400
    api = get_alpaca_client()
    if not api:
        return jsonify({'error': 'Alpaca client not configured'}), 503
    try:
        order_data = MarketOrderRequest(symbol=symbol, qty=qty, side=OrderSide.SELL, time_in_force=TimeInForce.GTC)
        order = api.submit_order(order_data)
        return jsonify({'status': 'success', 'order_id': str(order.id), 'symbol': symbol, 'qty': qty, 'side': 'sell'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alpaca/orders', methods=['GET'])
def get_orders():
    try:
        api = get_alpaca_client()
        orders = api.get_orders()
        result = []
        for o in orders:
            result.append({
                'id': str(o.id),
                'symbol': o.symbol,
                'qty': float(o.qty),
                'side': str(o.side),
                'status': str(o.status),
                'filled_at': str(o.filled_at),
                'filled_avg_price': float(o.filled_avg_price) if o.filled_avg_price else None
            })
        return jsonify({'orders': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================
# 시장 지표 API (S&P500, 나스닥, 다우, VIX, 금, 비트코인)
# ============================================================
MARKET_INDICATORS = [
    {'symbol': '^GSPC',  'label': 'S&P 500',     'type': 'index'},
    {'symbol': '^DJI',   'label': 'Dow 30',       'type': 'index'},
    {'symbol': '^IXIC',  'label': 'Nasdaq',       'type': 'index'},
    {'symbol': '^RUT',   'label': 'Russell 2000', 'type': 'index'},
    {'symbol': '^VIX',   'label': 'VIX',          'type': 'vix'},
    {'symbol': 'GC=F',   'label': 'Gold',         'type': 'commodity'},
    {'symbol': 'BTC-USD','label': 'Bitcoin',      'type': 'crypto'},
    {'symbol': 'DX-Y.NYB','label': 'USD Index',   'type': 'fx'},
]

_price_cache = {}   # symbol → {'data': ..., 'ts': ...}  30분 캐시
_prices_cache = {}  # symbols(str) → {'data': ..., 'ts': ...}  30분 캐시
_market_cache = {'data': None, 'ts': 0}

@app.route('/api/market/indicators', methods=['GET'])
def get_market_indicators():
    import time
    global _market_cache
    # 30분 캐시
    if _market_cache['data'] and time.time() - _market_cache['ts'] < 1800:
        return jsonify(_market_cache['data'])
    results = []
    for item in MARKET_INDICATORS:
        try:
            # Finnhub 분기 (미국 지표만, 한국/FX 제외)
            if USE_FINNHUB and _is_us(item['symbol']) and not item['symbol'].startswith('^'):
                q = _fh('/quote', {'symbol': item['symbol']})
                price = round(float(q.get('c', 0)), 2)
                prev  = round(float(q.get('pc', price)), 2)
                if not price:
                    continue
                change = round(price - prev, 2)
                change_pct = round((change / prev) * 100, 2) if prev else 0
            else:
                ticker = yf.Ticker(item['symbol'])
                hist = ticker.history(period='5d')
                if hist.empty:
                    continue
                close_val = hist["Close"].dropna()
                if close_val.empty:
                    continue
                price = round(float(close_val.iloc[-1]), 2)
                prev_val = hist['Close'].dropna()
                prev  = round(float(prev_val.iloc[-2]), 2) if len(prev_val) >= 2 else price
                change = round(price - prev, 2)
                change_pct = round((change / prev) * 100, 2) if prev else 0
            results.append({
                'symbol':     item['symbol'],
                'label':      item['label'],
                'type':       item['type'],
                'price':      price,
                'change':     change,
                'change_pct': change_pct,
            })
        except Exception as e:
            results.append({'symbol': item['symbol'], 'label': item['label'], 'error': str(e)})
    resp = {'indicators': results, 'timestamp': datetime.now().isoformat()}
    if any(r.get('price') for r in results):
        _market_cache['data'] = resp
        _market_cache['ts'] = time.time()
    return jsonify(resp)

# ============================================================
# 종목 검색 API (Yahoo Finance)
# ============================================================
@app.route('/api/stock/search', methods=['GET'])
def search_stock():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'results': []})
    try:
        import urllib.request, json as json_lib
        encoded_query = urllib.parse.quote(query)
        url = f'https://query1.finance.yahoo.com/v1/finance/search?q={encoded_query}&lang=ko-KR&region=KR&quotesCount=10&newsCount=0&listsCount=0'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Accept-Language': 'ko-KR,ko;q=0.9'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json_lib.loads(resp.read().decode('utf-8'))
        quotes = data.get('quotes', [])
        results = []
        for q in quotes:
            symbol = q.get('symbol', '')
            name = q.get('longname') or q.get('shortname') or symbol
            exchange = q.get('exchange', '')
            qtype = q.get('quoteType', '')
            if qtype not in ('EQUITY', 'ETF'):
                continue
            results.append({
                'symbol': symbol,
                'name': name,
                'exchange': exchange,
                'type': qtype
            })
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e), 'results': []}), 500

# ============================================================
# 주가 히스토리 DB 저장 (백테스팅용)
# ============================================================
import sqlite3
import schedule
import threading
import time as time_module
import time

DB_PATH = os.path.join(os.path.dirname(__file__), 'stock.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_stock_price_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS stock_price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            open REAL, high REAL, low REAL, close REAL, volume INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(symbol, date)
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_sph_symbol_date ON stock_price_history(symbol, date)')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS backtest_watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print('✅ stock_price_history DB 초기화 완료')

def fetch_and_save_history(symbol, period='2y'):
    """주가 히스토리 가져와서 DB에 저장 (USE_FINNHUB=True 시 Finnhub 사용)"""
    try:
        # Finnhub 분기 (미국 주식만)
        if USE_FINNHUB and _is_us(symbol):
            rows = _fh_history(symbol, period)
            if not rows:
                print(f'⚠️ {symbol}: Finnhub 데이터 없음')
                return 0
            conn = get_db()
            saved = 0
            for r in rows:
                try:
                    conn.execute('''
                        INSERT OR IGNORE INTO stock_price_history (symbol, date, open, high, low, close, volume)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (symbol, r['date'], r['open'], r['high'], r['low'], r['close'], r['volume']))
                    saved += conn.execute('SELECT changes()').fetchone()[0]
                except:
                    pass
            conn.commit()
            conn.close()
            print(f'✅ {symbol}: {saved}건 저장 (Finnhub)')
            return saved
        # yfinance
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)
        if hist.empty:
            print(f'⚠️ {symbol}: 데이터 없음')
            return 0

        conn = get_db()
        saved = 0
        for date, row in hist.iterrows():
            date_str = date.strftime('%Y-%m-%d')
            try:
                conn.execute('''
                    INSERT OR IGNORE INTO stock_price_history (symbol, date, open, high, low, close, volume)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (symbol, date_str, round(float(row['Open']), 4), round(float(row['High']), 4),
                      round(float(row['Low']), 4), round(float(row['Close']), 4), int(row['Volume'])))
                saved += conn.execute('SELECT changes()').fetchone()[0]
            except:
                pass
        conn.commit()
        conn.close()
        print(f'✅ {symbol}: {saved}건 저장')
        return saved
    except Exception as e:
        print(f'❌ {symbol} 오류: {e}')
        return 0

def daily_update():
    """매일 저녁 12시 — 워치리스트 종목 최신 데이터 업데이트"""
    print('🔄 일일 주가 업데이트 시작...')
    conn = get_db()
    symbols = [r['symbol'] for r in conn.execute('SELECT symbol FROM backtest_watchlist').fetchall()]
    conn.close()

    # 기본 종목 항상 포함
    default_symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'META', 'AMZN', 'AMD', 'QQQ', 'SPY']
    all_symbols = list(set(symbols + default_symbols))

    for symbol in all_symbols:
        fetch_and_save_history(symbol, period='5d')  # 최근 5일치만 업데이트
        time_module.sleep(0.5)  # API 과호출 방지
    print(f'✅ 일일 업데이트 완료: {len(all_symbols)}개 종목')

# 스케줄 등록 (매일 00:00)
schedule.every().day.at('00:00').do(daily_update)

def run_scheduler():
    while True:
        schedule.run_pending()
        time_module.sleep(60)

# ── 주가 히스토리 조회 API ────────────────────────────────
@app.route('/api/stock/history', methods=['GET'])
def get_history():
    symbol = request.args.get('symbol', 'AAPL').upper()
    start = request.args.get('start', '')
    end = request.args.get('end', '')
    try:
        conn = get_db()
        query = 'SELECT date, open, high, low, close, volume FROM stock_price_history WHERE symbol = ?'
        params = [symbol]
        if start:
            query += ' AND date >= ?'; params.append(start)
        if end:
            query += ' AND date <= ?'; params.append(end)
        query += ' ORDER BY date ASC'
        rows = conn.execute(query, params).fetchall()
        conn.close()

        if not rows:
            # DB에 없으면 yfinance에서 가져와서 저장
            fetch_and_save_history(symbol, period='2y')
            conn = get_db()
            rows = conn.execute(query, params).fetchall()
            conn.close()

        return jsonify({
            'symbol': symbol,
            'count': len(rows),
            'data': [{'date': r['date'], 'open': r['open'], 'high': r['high'],
                      'low': r['low'], 'close': r['close'], 'volume': r['volume']} for r in rows]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── 워치리스트 관리 API ───────────────────────────────────
@app.route('/api/stock/watchlist', methods=['GET'])
def get_watchlist():
    conn = get_db()
    rows = conn.execute('SELECT symbol FROM backtest_watchlist ORDER BY symbol').fetchall()
    conn.close()
    return jsonify({'symbols': [r['symbol'] for r in rows]})

@app.route('/api/stock/watchlist', methods=['POST'])
def add_watchlist():
    symbol = request.json.get('symbol', '').upper()
    if not symbol:
        return jsonify({'error': 'symbol 필요'}), 400
    conn = get_db()
    try:
        conn.execute('INSERT OR IGNORE INTO backtest_watchlist (symbol) VALUES (?)', (symbol,))
        conn.commit()
        conn.close()
        # 즉시 히스토리 수집
        threading.Thread(target=fetch_and_save_history, args=(symbol, '2y'), daemon=True).start()
        return jsonify({'ok': True, 'symbol': symbol})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/watchlist/<symbol>', methods=['DELETE'])
def remove_watchlist(symbol):
    conn = get_db()
    conn.execute('DELETE FROM backtest_watchlist WHERE symbol = ?', (symbol.upper(),))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

# ── 초기 데이터 수집 API (최초 1회) ─────────────────────
@app.route('/api/stock/init-history', methods=['POST'])
def init_history():
    symbols = request.json.get('symbols', ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'QQQ', 'SPY'])
    def run():
        for s in symbols:
            fetch_and_save_history(s, period='2y')
            time_module.sleep(0.5)
    threading.Thread(target=run, daemon=True).start()
    return jsonify({'ok': True, 'message': f'{len(symbols)}개 종목 수집 시작'})

if __name__ == '__main__':
    init_stock_price_db()
    # 스케줄러 백그라운드 실행
    threading.Thread(target=run_scheduler, daemon=True).start()
    # 외부 노출 금지: Node 대시보드(localhost)에서만 접근.
    # 별도 호스트에 띄우려면 PYTHON_HOST=0.0.0.0 + 방화벽 + INTERNAL_API_TOKEN 필수.
    _host = os.environ.get('PYTHON_HOST', '127.0.0.1')
    _port = int(os.environ.get('STOCK_PORT', '5001'))
    print(f'🚀 주식 서버 시작: http://{_host}:{_port}')
    print('📅 매일 00:00 주가 자동 업데이트 예정')
    app.run(host=_host, port=_port, debug=False)

