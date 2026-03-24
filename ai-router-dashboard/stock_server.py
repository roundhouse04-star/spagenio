from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
from datetime import datetime
import os

try:
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
    ALPACA_AVAILABLE = True
except ImportError:
    ALPACA_AVAILABLE = False

app = Flask(__name__)
CORS(app)

ALPACA_API_KEY = 'PKNSYVAVTRCTHC675277MT7WLU'
ALPACA_SECRET_KEY = 'E4MZhS8ju6QdCrZBaBgsYw2xc7YrKvdQiTeKCC9vYE3C'

def get_alpaca_client():
    if not ALPACA_AVAILABLE:
        return None
    return TradingClient(ALPACA_API_KEY, ALPACA_SECRET_KEY, paper=True)

@app.route('/price', methods=['GET'])
def get_price():
    symbol = request.args.get('symbol', 'AAPL')
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period='1d')
        if hist.empty:
            return jsonify({'error': f'{symbol} 데이터 없음'}), 404
        current_price = hist['Close'].iloc[-1]
        open_price = hist['Open'].iloc[-1]
        change = current_price - open_price
        change_pct = (change / open_price) * 100
        return jsonify({
            'symbol': symbol,
            'name': info.get('longName', symbol),
            'price': round(current_price, 2),
            'open': round(open_price, 2),
            'change': round(change, 2),
            'change_pct': round(change_pct, 2),
            'volume': int(hist['Volume'].iloc[-1]),
            'currency': info.get('currency', 'USD'),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/prices', methods=['GET'])
def get_prices():
    symbols = request.args.get('symbols', 'AAPL,MSFT,GOOGL,NVDA,TSLA')
    symbol_list = [s.strip() for s in symbols.split(',')]
    results = []
    for symbol in symbol_list:
        try:
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
    return jsonify({'stocks': results, 'timestamp': datetime.now().isoformat()})


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
def buy_stock():
    data = request.json
    symbol = data.get('symbol')
    qty = data.get('qty', 1)
    try:
        api = get_alpaca_client()
        order_data = MarketOrderRequest(symbol=symbol, qty=qty, side=OrderSide.BUY, time_in_force=TimeInForce.GTC)
        order = api.submit_order(order_data)
        return jsonify({'status': 'success', 'order_id': str(order.id), 'symbol': symbol, 'qty': qty, 'side': 'buy'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alpaca/sell', methods=['POST'])
def sell_stock():
    data = request.json
    symbol = data.get('symbol')
    qty = data.get('qty', 1)
    try:
        api = get_alpaca_client()
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

if __name__ == '__main__':
    print('🚀 주식 서버 시작: http://localhost:5001')
    app.run(host='0.0.0.0', port=5001, debug=True)
