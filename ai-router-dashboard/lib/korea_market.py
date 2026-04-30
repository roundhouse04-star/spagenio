"""
korea_market.py — 한국 시장 (KOSPI/KOSDAQ) 데이터 수집 및 분석.
quant_engine.py 에서 분리.

- get_naver_top_stocks: 네이버 금융 거래량 상위 종목 크롤링
- get_korea_market_analysis: 거래량 + RSI 점수 산출 → TOP 10
"""
import os
import sqlite3
from datetime import datetime
from .quant_strategies import analyze_rsi


DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'stock.db')


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
