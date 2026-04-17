import React, { useState } from 'react';

const S = {
  wrap: { minHeight: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { fontSize: 28, fontWeight: 500, fontFamily: "'Playfair Display', serif", color: '#1E2A3A', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: '#8A919C', marginBottom: 24, textAlign: 'center' },
  box: { background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '32px 36px 28px', width: '100%', maxWidth: 520, boxShadow: '0 4px 20px rgba(30,42,58,0.08)' },
  title: { fontSize: 15, fontWeight: 800, color: '#1E2A3A', marginBottom: 20 },
  allAgree: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#EEEDEA', border: '1.5px solid #E2E0DC', borderRadius: 3, marginBottom: 14, cursor: 'pointer' },
  termItem: { border: '1px solid #eee', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  termHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', cursor: 'pointer', background: '#FAFAF8' },
  badge: (req) => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: req ? '#EEEDEA' : '#F5F4F0', color: req ? '#1E2A3A' : '#8A919C' }),
  termBody: (open) => ({ display: open ? 'block' : 'none', padding: '14px 16px', fontSize: 12, color: '#8A919C', lineHeight: 1.7, background: 'white', borderTop: '1px solid #F5F4F0', maxHeight: 160, overflowY: 'auto' }),
  termCheck: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FAFAF8', borderTop: '1px solid #F5F4F0' },
  btn: { width: '100%', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 3, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  btnOut: { width: '100%', background: 'white', color: '#8A919C', border: '1px solid #eee', borderRadius: 3, padding: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
};

const TERMS = [
  { id: 'agree_terms', required: true, title: '서비스 이용약관', content: `제1조 (목적) 본 약관은 Travellog가 제공하는 여행 SNS 플랫폼 서비스의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.\n\n제2조 (서비스 이용) 서비스는 여행 후기 게시, 장소 공유, 일정 플래닝 등의 기능을 제공합니다.\n\n제3조 (게시물 관련) 이용자가 업로드한 사진, 글 등 게시물의 저작권은 이용자 본인에게 있습니다.\n\n제4조 (이용자 의무) 타인의 정보를 도용하거나 허위 정보를 입력해서는 안 됩니다.` },
  { id: 'agree_privacy', required: true, title: '개인정보 수집 및 이용 동의', content: `수집 항목: 닉네임, 이메일, 비밀번호(암호화 저장)\n자동 수집: 서비스 이용기록, 접속 로그\n\n수집 목적: 회원 가입 및 서비스 이용 본인 확인, 이메일 인증, 비밀번호 찾기\n\n보유 기간: 회원 탈퇴 시까지 보유하며 즉시 파기\n\n보안: 비밀번호는 bcrypt 해시로 저장됩니다.` },
  { id: 'agree_content', required: true, title: '게시물 및 콘텐츠 정책 동의', content: `이용자가 Travellog에 게시한 여행 사진, 장소 정보, 여행 코스 등은 서비스 내 다른 이용자에게 공개될 수 있습니다.\n\n금지 콘텐츠: 타인의 저작권을 침해하는 콘텐츠, 허위 여행 후기, 무허가 광고성 게시물\n\n위반 시 예고 없이 삭제되거나 계정이 정지될 수 있습니다.` },
  { id: 'agree_location', required: false, title: '위치 정보 활용 동의', content: `여행 장소 자동 태그, 근처 여행 코스 추천 등의 기능을 위해 위치 정보를 활용할 수 있습니다. 동의하지 않아도 서비스의 기본 이용에는 제한이 없습니다.` },
  { id: 'agree_marketing', required: false, title: '서비스 소식 및 이벤트 알림 수신', content: `신규 기능 업데이트, 여행 이벤트, 서비스 소식 등을 이메일로 받아보실 수 있습니다. 동의하지 않아도 서비스 이용에 제한이 없으며 언제든지 수신 거부가 가능합니다.` },
];

export default function Terms() {
  const [agreed, setAgreed] = useState({});
  const [opened, setOpened] = useState({});

  const allChecked = TERMS.every(t => agreed[t.id]);
  const requiredOk = TERMS.filter(t => t.required).every(t => agreed[t.id]);

  const toggleAll = () => {
    const next = !allChecked;
    const a = {};
    TERMS.forEach(t => a[t.id] = next);
    setAgreed(a);
  };

  const go = () => {
    sessionStorage.setItem('terms_agree', JSON.stringify(agreed));
    window.location.href = '/register';
  };

  return (
    <div style={S.wrap}>
      <div style={S.logo}>✈ Travellog</div>
      <div style={S.sub}>Please agree to the terms to create your account</div>
      <div style={S.box}>
        <div style={S.title}>약관 동의</div>

        <div style={S.allAgree} onClick={toggleAll}>
          <input type="checkbox" checked={allChecked} onChange={toggleAll} onClick={e => e.stopPropagation()}
            style={{ width: 18, height: 18, accentColor: '#1E2A3A', cursor: 'pointer' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1E2A3A' }}>전체 약관에 동의합니다</span>
        </div>

        {TERMS.map(term => (
          <div key={term.id} style={S.termItem}>
            <div style={S.termHeader} onClick={() => setOpened(p => ({...p, [term.id]: !p[term.id]}))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={S.badge(term.required)}>{term.required ? 'Required' : 'Optional'}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#4A5568' }}>{term.title}</span>
              </div>
              <span style={{ color: '#8A919C', fontSize: 12, transform: opened[term.id] ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
            </div>
            <div style={S.termBody(opened[term.id])}>
              {term.content.split('\n').map((line, i) => <p key={i} style={{ marginBottom: 4 }}>{line}</p>)}
            </div>
            <div style={S.termCheck}>
              <input type="checkbox" checked={!!agreed[term.id]}
                onChange={e => setAgreed(p => ({...p, [term.id]: e.target.checked}))}
                style={{ width: 16, height: 16, accentColor: '#1E2A3A', cursor: 'pointer' }} />
              <label style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer' }}
                onClick={() => setAgreed(p => ({...p, [term.id]: !p[term.id]}))}>
                {term.title}에 동의합니다 ({term.required ? 'Required' : 'Optional'})
              </label>
            </div>
          </div>
        ))}

        <button style={{ ...S.btn, background: requiredOk ? '#1E2A3A' : '#E2E0DC', cursor: requiredOk ? 'pointer' : 'not-allowed' }}
          onClick={go} disabled={!requiredOk}>NEXT → CREATE ACCOUNT</button>
        <button style={S.btnOut} onClick={() => window.location.href = '/'}>← BACK TO SIGN IN</button>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#8A919C' }}>© 2026 TRAVEL SPAGENIO</div>
    </div>
  );
}
