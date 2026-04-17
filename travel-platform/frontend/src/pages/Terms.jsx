import React, { useState } from 'react';

const S = {
  wrap: { minHeight: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { fontSize: 28, fontWeight: 500, fontFamily: "'Playfair Display', serif", color: '#1E2A3A', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: '#8A919C', marginBottom: 24, textAlign: 'center' },
  box: { background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '32px 36px 28px', width: '100%', Width: 520, boxShadow: '0 4px 20px rgba(30,42,58,0.08)' },
  title: { fontSize: 15, fontWeight: 800, color: '#1E2A3A', marginBottom: 20 },
  allAgree: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#EEEDEA', border: '1.5px solid #E2E0DC', borderRadius: 3, marginBottom: 14, cursor: 'pointer' },
  termItem: { border: '1px solid #eee', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  termHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', cursor: 'pointer', background: '#FAFAF8' },
  badge: (req) => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: req? '#EEEDEA' : '#F5F4F0', color: req? '#1E2A3A' : '#8A919C' }),
  termBody: (open) => ({ display: open? 'block' : 'none', padding: '14px 16px', fontSize: 12, color: '#8A919C', lineHeight: 1.7, background: 'white', borderTop: '1px solid #F5F4F0', Height: 160, overflowY: 'auto' }),
  termCheck: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FAFAF8', borderTop: '1px solid #F5F4F0' },
  btn: { width: '100%', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 3, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  btnOut: { width: '100%', background: 'white', color: '#8A919C', border: '1px solid #eee', borderRadius: 3, padding: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
};

const TERMS = [
  { id: 'agree_terms', required: true, title: 'Service Terms', content: `Article 1 (Purpose) These terms define the rights, obligations, and responsibilities between Spagenio and users regarding the use of the Spagenio travel SNS platform.\n\nArticle 2 (Service Use) The service provides travel reviews, place sharing, and schedule planning features.\n\nArticle 3 (Posts) Users retain copyright of the photos, text, and posts they upload.\n\nArticle 4 (User Obligations) Users must not impersonate others or submit false information.` },
  { id: 'agree_privacy', required: true, title: 'Info collection and Use Consent', content: `Collected: Nickname, Email, Password (encrypted)\nAuto-collected: service usage records, access logs\n\nPurpose: account registration, identity verification, email verification, password recovery\n\nRetention: kept until account deletion, then destroyed immediately\n\nSecurity: passwords are stored as bcrypt hashes.` },
  { id: 'agree_content', required: true, title: 'POSTS and Content Policy Consent', content: `Travel photos, place info, and travel routes posted on Spagenio may be visible to other users.\n\nProhibited content: copyright-infringing material, false travel reviews, unauthorized promotional posts\n\nViolations may result in deletion or account suspension without notice.` },
  { id: 'agree_location', required: false, title: 'Location Info use Consent', content: `Location data may be used for auto-tagging travel places and nearby route recommendations. Basic service use is not restricted if you decline.` },
  { id: 'agree_marketing', required: false, title: 'Receive service news & event alerts', content: `Receive feature updates, travel events, and service news by email. Service use is not restricted if you decline, and you can unsubscribe anytime.` },
];

export default function Terms() {
  const [agreed, setAgreed] = useState({});
  const [opened, setOpened] = useState({});

  const allChecked = TERMS.every(t => agreed[t.id]);
  const requiredOk = TERMS.filter(t => t.required).every(t => agreed[t.id]);

  const toggleAll = () => {
    const next =!allChecked;
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
        <div style={S.title}>Accept Terms</div>

        <div style={S.allAgree} onClick={toggleAll}>
          <input type="checkbox" checked={allChecked} onChange={toggleAll} onClick={e => e.stopPropagation()}
            style={{ width: 18, height: 18, accentColor: '#1E2A3A', cursor: 'pointer' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1E2A3A' }}>ALL Terms — agree</span>
        </div>

        {TERMS.map(term => (
          <div key={term.id} style={S.termItem}>
            <div style={S.termHeader} onClick={() => setOpened(p => ({...p, [term.id]:!p[term.id]}))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={S.badge(term.required)}>{term.required? 'Required' : 'Optional'}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#4A5568' }}>{term.title}</span>
              </div>
              <span style={{ color: '#8A919C', fontSize: 12, transform: opened[term.id]? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
            </div>
            <div style={S.termBody(opened[term.id])}>
              {term.content.split('\n').map((line, i) => <p key={i} style={{ marginBottom: 4 }}>{line}</p>)}
            </div>
            <div style={S.termCheck}>
              <input type="checkbox" checked={!!agreed[term.id]}
                onChange={e => setAgreed(p => ({...p, [term.id]: e.target.checked}))}
                style={{ width: 16, height: 16, accentColor: '#1E2A3A', cursor: 'pointer' }} />
              <label style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer' }}
                onClick={() => setAgreed(p => ({...p, [term.id]:!p[term.id]}))}>
                {term.title} — agree ({term.required? 'Required' : 'Optional'})
              </label>
            </div>
          </div>
        ))}

        <button style={{...S.btn, background: requiredOk? '#1E2A3A' : '#E2E0DC', cursor: requiredOk? 'pointer' : 'not-allowed' }}
          onClick={go} disabled={!requiredOk}>NEXT → CREATE ACCOUNT</button>
        <button style={S.btnOut} onClick={() => window.location.href = '/'}>← BACK TO SIGN IN</button>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#8A919C' }}>© 2026 TRAVEL SPAGENIO</div>
    </div>
  );
}
