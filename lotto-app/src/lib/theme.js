export const theme = {
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textSub: '#6b7280',
  textMuted: '#9ca3af',
  success: '#10b981',
  danger: '#ef4444',
  warn: '#f59e0b',
  info: '#3b82f6',
};

export function ballColor(n) {
  if (n <= 10) return '#fbbf24';
  if (n <= 20) return '#60a5fa';
  if (n <= 30) return '#ef4444';
  if (n <= 40) return '#a78bfa';
  return '#34d399';
}
