import React from 'react';
import { AbsoluteFill } from 'remotion';

export const C = {
  bg: '#0e1116',
  panel: '#171c24',
  line: '#2b3340',
  text: '#e8edf4',
  dim: '#93a0b4',
  pass: '#4ccf83',
  fail: '#ff6b6b',
  skip: '#f5c04a',
  accent: '#7cb7ff',
};
export const MONO = "'Cascadia Mono', Consolas, monospace";
export const SANS = "'Segoe UI', system-ui, sans-serif";

// Content lives between y=96 and y=900; the caption band below it never covers a total or a verdict.
export const Shell: React.FC<{ label?: string; badge?: string; caption: string; children: React.ReactNode }> = ({ label, badge, caption, children }) => (
  <AbsoluteFill style={{ background: C.bg, color: C.text, fontFamily: SANS }}>
    <div style={{ position: 'absolute', left: 60, top: 30, fontSize: 28, fontWeight: 600, color: C.dim }}>{label ?? 'firstbad'}</div>
    {badge ? (
      <div style={{ position: 'absolute', right: 60, top: 22, fontSize: 26, padding: '8px 18px', border: `2px solid ${C.skip}`, borderRadius: 8, color: C.skip }}>{badge}</div>
    ) : null}
    <div style={{ position: 'absolute', left: 60, right: 60, top: 96, height: 804 }}>{children}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, background: '#05070a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 40, lineHeight: 1.3, textAlign: 'center', maxWidth: 1600, fontWeight: 500 }}>{caption}</div>
    </div>
  </AbsoluteFill>
);

const colourOf = (s: string) => (s === 'PASS' ? C.pass : s === 'FAIL' ? C.fail : s === 'SKIP' ? C.skip : C.text);

export const TermLine: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/\b(PASS|FAIL|SKIP)\b/).map((part, i) => (
      <span key={i} style={{ color: colourOf(part), fontWeight: /^(PASS|FAIL|SKIP)$/.test(part) ? 700 : 400 }}>{part}</span>
    ))}
  </>
);

export const Terminal: React.FC<{ lines: string[]; size?: number; title?: string; style?: React.CSSProperties }> = ({ lines, size = 25, title, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', ...style }}>
    <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.line}`, color: C.dim, fontSize: 22 }}>{title ?? 'docs/demo/recorded-run/transcript.txt'}</div>
    <div style={{ padding: '18px 22px', fontFamily: MONO, fontSize: size, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {lines.map((l, i) => (
        <div key={i}><TermLine text={l} /></div>
      ))}
    </div>
  </div>
);

export const Slot: React.FC<{ title: string; note: string; style?: React.CSSProperties }> = ({ title, note, style }) => (
  <div style={{ border: `3px dashed ${C.line}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, ...style }}>
    <div style={{ fontSize: 40, fontWeight: 600 }}>{title}</div>
    <div style={{ fontSize: 28, color: C.dim, maxWidth: 1200, textAlign: 'center' }}>{note}</div>
  </div>
);

export const Diff: React.FC<{ lines: string[]; size?: number; mark?: string }> = ({ lines, size = 20, mark }) => (
  <div style={{ fontFamily: MONO, fontSize: size, lineHeight: 1.45, whiteSpace: 'pre' }}>
    {lines.map((l, i) => {
      const colour = l.startsWith('+') ? C.pass : l.startsWith('-') ? C.fail : l.startsWith('@@') ? C.accent : C.dim;
      const marked = mark !== undefined && l.includes(mark) && (l.startsWith('+') || l.startsWith('-'));
      return <div key={i} style={{ color: colour, background: marked ? 'rgba(245,192,74,0.22)' : 'transparent', padding: '0 8px' }}>{l}</div>;
    })}
  </div>
);
