/**
 * 알림 미확인 개수를 주기적으로 갱신하는 훅.
 * 가장 간단한 방법은 focus 마다 재조회지만, 탭 뱃지는 백그라운드에서도 뜨므로 interval 사용.
 */
import { useEffect, useState } from 'react';
import { getUnreadCount } from '@/db/notifications';

export function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const n = await getUnreadCount();
        if (mounted) setCount(n);
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return count;
}
