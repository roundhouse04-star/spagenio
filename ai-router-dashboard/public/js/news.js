let allNews = [];
let currentCategory = 'all';

async function loadNews() {
  try {
    // 날짜 목록 먼저 로드
    const datesRes = await fetch('/api/news/dates');
    const datesData = await datesRes.json();
    updateDateFilter(datesData.dates || []);

    // 뉴스 목록 로드
    await applyNewsFilter();
  } catch (e) {
    document.getElementById('newsContent').innerHTML =
      '<p style="color:var(--muted)">뉴스 데이터 없음. n8n 워크플로우를 실행해주세요.</p>';
  }
}

function updateDateFilter(dates) {
  const select = document.getElementById('newsDateFilter');
  const current = select.value;
  select.innerHTML = '<option value="all">전체 기간</option>' +
    dates.map(d => `<option value="${d}" ${d === current ? 'selected' : ''}>${d}</option>`).join('');
}

async function applyNewsFilter() {
  const date = document.getElementById('newsDateFilter')?.value || 'all';
  const type = document.getElementById('newsTypeFilter')?.value || 'all';

  try {
    const params = new URLSearchParams();
    if (date !== 'all') params.append('date', date);
    if (type !== 'all') params.append('type', type);
    if (currentCategory !== 'all') params.append('category', currentCategory);

    const res = await fetch(`/api/news/list?${params.toString()}`);
    const data = await res.json();
    allNews = data.news || [];

    const count = document.getElementById('newsCount');
    if (count) count.textContent = `총 ${allNews.length}개`;

    renderNews(allNews);
  } catch (e) {
    document.getElementById('newsContent').innerHTML =
      '<p style="color:var(--muted)">뉴스 로드 실패</p>';
  }
}

function filterNewsByCategory(category, btn) {
  document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCategory = category;
  applyNewsFilter();
}

function renderNews(newsList) {
  const container = document.getElementById('newsContent');
  if (!newsList.length) {
    container.innerHTML = '<p style="color:var(--muted)">No news to display.</p>';
    return;
  }

  const categoryLabels = {
    global: '🌍 글로벌',
    korea: '🇰🇷 한국',
    it: '💻 IT',
    economy: '💰 경제'
  };

  container.innerHTML = newsList.map(n => `
    <div class="news-item">
      <div class="news-category">
        ${categoryLabels[n.category] || n.category}
        <span class="news-history-badge ${n.source || (n.use_claude ? 'claude' : 'raw')}" style="${n.source === 'claude' ? 'background:#eef2ff;color:#6366f1;border-color:#c7d2fe;' :
      n.source === 'gpt' ? 'background:#f0fdf4;color:#16a34a;border-color:#a7f3d0;' :
        'background:#f9fafb;color:#6b7280;border-color:#e5e7eb;'
    }">
          ${n.source === 'claude' ? '🤖 Claude' : n.source === 'gpt' ? '🟢 GPT' : '📡 RSS'}
        </span>
      </div>
      <div class="news-date">${n.date} · ${n.savedAt?.slice(11, 16)} collected</div>
      <div class="news-body">${n.content && n.content.trim() && n.content.trim() !== '제목없음' && n.content.trim() !== '-'
      ? n.content
      : '<span style="color:#d1d5db;font-style:italic;font-size:0.82rem;">No content</span>'
    }</div>
    </div>
  `).join('');
}

// 주식 탭 진입 시 뉴스도 로드
const originalSwitchTab = switchTab;

// ===== 뉴스 Claude 분석 토글 =====
let useClaudeAnalysis = false;

function onClaudeToggleChange() {
  useClaudeAnalysis = document.getElementById('claudeAnalysisToggle').checked;
  const status = document.getElementById('claudeAnalysisStatus');
  if (useClaudeAnalysis) {
    status.textContent = 'ON';
    status.className = 'news-mode-status on';
  } else {
    status.textContent = 'OFF';
    status.className = 'news-mode-status off';
  }
}

// ===== 뉴스 수집 트리거 =====
async function triggerNewsCollection(silent = false, source = null) {
  // source 결정: 명시적 전달 > 모델 선택 > claude 토글
  const model = document.getElementById('preferredModel')?.value || 'rss';
  const src = source || model || 'rss'; // rss | claude | gpt

  const btn = silent ? null : document.getElementById('fetchTodayBtn');
  if (btn) {
    btn.textContent = src === 'claude' ? '⏳ Claude Analyzing...' : src === 'gpt' ? '⏳ GPT Analyzing...' : '⏳ Collecting RSS...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/news/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src })
    });
    const data = await res.json();
    if (!silent && btn) btn.textContent = '✅ Done!';
    setTimeout(() => loadNews(), src === 'rss' ? 2000 : 5000);
  } catch (e) {
    if (!silent && btn) btn.textContent = '❌ Error';
  }

  if (!silent && btn) {
    setTimeout(() => {
      btn.textContent = '🔄 Collect News';
      btn.disabled = false;
    }, 6000);
  }
}

// ===== 퀀트 엔진 =====