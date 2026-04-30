"""
quant_cache.py — 메모리 캐시 (30분 TTL).
quant_engine.py 에서 분리. 야후 이용약관 준수: 영구 저장 없이 메모리만.
"""
import time

_cache = {}          # { key: {'data': ..., 'ts': timestamp} }
CACHE_TTL = 60 * 10  # 10분 (원문은 즉시 폐기, 점수는 DB 저장)


def cache_get(key: str):
    """캐시에서 데이터 조회. 만료됐으면 None 반환."""
    entry = _cache.get(key)
    if not entry:
        return None
    if time.time() - entry['ts'] > CACHE_TTL:
        del _cache[key]
        return None
    return entry['data']


def cache_set(key: str, data):
    """캐시에 데이터 저장 (메모리만, DB 저장 안 함)."""
    _cache[key] = {'data': data, 'ts': time.time()}


def cache_clear_expired():
    """만료된 캐시 정리 (메모리 누수 방지)."""
    now = time.time()
    expired = [k for k, v in _cache.items() if now - v['ts'] > CACHE_TTL]
    for k in expired:
        del _cache[k]
