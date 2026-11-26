// One component per scene. With `t` (seconds into the scene) it animates with the narration and plays footage; without
// `t` it shows the scene's final state for the storyboard still (`phase` picks a second layout).
import React from 'react';
import { Img, Sequence, staticFile } from 'remotion';
import { Video } from '@remotion/media';
import data from './generated/data.json';
import { C, Diff, MONO, Shell, Slot, Terminal } from './ui';

const REPLAY = 'Replay of the recorded live run, 25 Nov 2026 · time compressed';
const SHARE = 'Real share page from the recorded run, opened logged out';
const FPS = 30;
const narration = (id: string) => data.scenes.find((s) => s.id === id)!.narration;
// Sample caption for stills: the start of one sentence of the scene.
const sample = (id: string, k = 0) => {
  const words = narration(id).split(/(?<=[.?!])\s+/)[k]!.split(/\s+/);
  return words.length > 15 ? `${words.slice(0, 15).join(' ')} …` : words.join(' ');
};
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

// Footage box: a 16:9 stage inside the content area.
const W = 1429;
const H = 804;

// Share pages use a wider stage: only the blank strip under the page falls outside it.
const SW = 1584;
const SH = (SW * 9) / 16;

// Push in on a point (box coordinates) between two times; `contentH` is the height of what is being scaled.
const zoomAt = (t: number, from: number, to: number, fx: number, fy: number, max: number, w = W, contentH = H) => {
  const p = ease(clamp((t - from) / (to - from)));
  const s = 1 + (max - 1) * p;
  const x = Math.max(w - w * max, Math.min(0, w / 2 - fx * max)) * p;
  const y = Math.max(H - contentH * max, Math.min(0, H / 2 - fy * max)) * p;
  return { s, x, y };
};

const Stage: React.FC<{ width?: number; children: React.ReactNode }> = ({ width = W, children }) => (
  <div style={{ position: 'relative', width, height: H, margin: '0 auto', overflow: 'hidden', borderRadius: 10, background: '#fff' }}>{children}</div>
);

const Clip: React.FC<{ src: string; from?: number; style?: React.CSSProperties }> = ({ src, from = 0, style }) => (
  <Sequence from={Math.round(from * FPS)} layout="none">
    <Video src={staticFile(src)} muted style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, ...style }} />
  </Sequence>
);

// Share page: first frame, then the autoplay recording, then a high-resolution still, pushed in on the total at `push`.
const Share: React.FC<{ t: number | undefined; name: string; still: string; play: number; hold: number; push: number }> = ({ t, name, still, play, hold, push }) => {
  const page: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: SW, height: SH, maxWidth: 'none' };
  if (t === undefined) return <Stage width={SW}><Img src={staticFile(`preview/${still}`)} style={page} /></Stage>;
  const z = zoomAt(t, push, push + 1.5, 1620 * (SW / 1920), 440 * (SH / 1080), 2.3, SW, SH);
  return (
    <Stage width={SW}>
      {t < play ? <Img src={staticFile(`preview/${name}-first.png`)} style={page} /> : null}
      {t >= play && t < hold ? <Clip src={`clips/${name}.mp4`} from={play} style={page} /> : null}
      {t >= hold ? <Img src={staticFile(`preview/${still}`)} style={{ ...page, left: z.x, top: z.y, width: SW * z.s, height: SH * z.s }} /> : null}
    </Stage>
  );
};

// The cart box of a 1920x1080-layout share-page screenshot, enlarged.
const CartCrop: React.FC<{ src: string; scale: number }> = ({ src, scale }) => (
  <div style={{ width: 430 * scale, height: 215 * scale, overflow: 'hidden', borderRadius: 10, background: '#fff' }}>
    <Img src={staticFile(src)} style={{ width: 1920 * scale, maxWidth: 'none', marginLeft: -1400 * scale, marginTop: -350 * scale, display: 'block' }} />
  </div>
);

export type BoardProps = { scene: string; phase?: number; t?: number; caption?: string };

export const Board: React.FC<BoardProps> = ({ scene, phase = 0, t, caption }) => {
  const r = data.replay;
  const still = t === undefined;
  const on = (at: number) => still || t >= at;
  const fade = (at: number) => (still ? 1 : clamp((t - at) / 0.25));
  const cap = (id: string, k = 0) => caption ?? sample(id, k);
  const secondLayout = (at: number) => (still ? phase === 1 : t >= at);

  switch (scene) {
    case 'S1': {
      // Cart column of the shop capture, in box coordinates.
      const z = still ? null : zoomAt(t, 6.0, 7.6, 1500 * (W / 1920), 790 * (H / 1080), 2.0);
      return (
        <Shell label="The bug" badge="Demo shop, driven by a script for this video · not a Kane run" caption={cap('S1', 2)}>
          {z === null ? (
            <Slot title="Footage: the Corner Shop at HEAD" note={'Add Tote bag, add Mug, type SAVE10, Apply. Push in on "Code SAVE10 applied" next to "Total: $20.00".'} style={{ height: 800 }} />
          ) : (
            <Stage>
              <Clip src="clips/s1-shop.mp4" style={{ transformOrigin: '0 0', transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})` }} />
            </Stage>
          )}
        </Shell>
      );
    }
    case 'S2':
      return (
        <Shell label=" " caption={cap('S2')}>
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -2 }}>firstbad</div>
            <div style={{ fontSize: 46, color: C.accent, opacity: fade(3.9) }}>git bisect with a real-browser oracle</div>
          </div>
          <div style={{ margin: '70px auto 0', width: 1560, background: C.panel, borderRadius: 12, padding: '30px 40px', fontFamily: MONO, fontSize: 28, lineHeight: 1.9, opacity: fade(7.3) }}>
            <div><span style={{ color: C.accent }}>--do</span> "{data.check.do}"</div>
            <div><span style={{ color: C.accent }}>--store</span> "{data.check.store}"</div>
            <div><span style={{ color: C.accent }}>--expect</span> "{data.check.expected}"</div>
          </div>
        </Shell>
      );
    case 'S3': {
      if (!secondLayout(8.0)) {
        return (
          <Shell label="Setup · README Quickstart" caption={cap('S3')}>
            <div style={{ width: 1400, margin: '30px auto 0', background: C.panel, borderRadius: 12, padding: '34px 44px', fontFamily: MONO, fontSize: 34, lineHeight: 2 }}>
              {data.quickstart.map((l) => {
                const step = /^(npm ci|npm run build)$/.test(l) ? 1 : /node dist\/cli\.js demo/.test(l) ? 2 : 0;
                const lit = step === 1 ? on(4.9) : step === 2 ? on(6.4) : false;
                return (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', color: lit ? C.text : C.dim }}>
                    <span>{l}</span>
                    {lit ? <span style={{ fontFamily: 'Segoe UI', color: step === 1 ? C.accent : C.pass, fontSize: 28 }}>step {step}</span> : null}
                  </div>
                );
              })}
            </div>
          </Shell>
        );
      }
      return (
        <Shell label="node dist/cli.js demo" badge="live, cut after the first Kane run starts" caption={cap('S3', 2)}>
          {still ? (
            <Slot title="Footage: your terminal, recorded live and unedited" note={'Command typed, history generated, check printed, the "firstbad: hunting …" line, first Kane run in progress. About 15 to 20 seconds.'} style={{ height: 800 }} />
          ) : (
            // The whole captured window, 1898x990, scaled to the content width; nothing cropped.
            <div style={{ position: 'relative', width: 1541, height: 804, margin: '0 auto', border: `1px solid ${C.line}` }}>
              <Clip src="clips/s3-live.mp4" from={8.0} style={{ width: 1541, height: 804 }} />
            </div>
          )}
        </Shell>
      );
    }
    case 'S4':
      return (
        <Shell label="Bracket: can the check tell good from bad?" badge={REPLAY} caption={cap('S4', 1)}>
          <Terminal lines={[on(3.4) ? r.hunting : ' ', on(10.4) ? r.bracket[0]! : ' ', on(13.7) ? r.bracket[1]! : ' ']} size={25} style={{ marginTop: 40 }} />
          <div style={{ display: 'flex', gap: 60, justifyContent: 'center', marginTop: 70 }}>
            {([['HEAD', '$20.00', 'FAIL', C.fail, 11.7], ['v1.0', '$18.00', 'PASS', C.pass, 14.9]] as const).map(([ref, value, verdict, colour, at]) => (
              <div key={ref} style={{ border: `3px solid ${colour}`, borderRadius: 14, padding: '24px 70px', textAlign: 'center', opacity: fade(at) }}>
                <div style={{ fontSize: 32, color: C.dim }}>{ref} · Kane read</div>
                <div style={{ fontSize: 84, fontWeight: 700 }}>{value}</div>
                <div style={{ fontSize: 40, fontWeight: 700, color: colour }}>{verdict}</div>
              </div>
            ))}
          </div>
        </Shell>
      );
    case 'S5':
      return (
        <Shell label="Kane Test Manager · run #1 (HEAD)" badge={SHARE} caption={cap('S5', 3)}>
          <Share t={t} name="s5-share" still="share-1.png" play={5.0} hold={12.6} push={16.3} />
        </Shell>
      );
    case 'S6':
      return (
        <Shell label="Different failure, so skipped" badge={REPLAY} caption={cap('S6', 1)}>
          <Terminal lines={r.skips.map((l, i) => (on(4.6 + i * 0.7) ? l : ' '))} size={25} style={{ marginTop: 60 }} />
          <div style={{ marginTop: 90, textAlign: 'center' }}>
            <div style={{ fontSize: 36, color: C.dim, opacity: fade(7.0) }}>The server crashed on boot. That is not the checkout bug, so no commit here is blamed.</div>
            <div style={{ fontSize: 76, fontWeight: 700, color: C.skip, marginTop: 40, opacity: fade(13.6) }}>0 Kane runs · 0 credits</div>
          </div>
        </Shell>
      );
    case 'S7': {
      const said = [3.1, 3.7, 4.3, 4.9, 5.4, 6.0];
      const bisect = data.timeline.filter((x) => x.phase === 'bisect');
      const judged = bisect.filter((x) => x.verdict !== 'SKIP');
      const shown = new Map<number, string>(data.timeline.filter((x) => x.phase === 'bracket' || x.verdict === 'SKIP').map((x) => [x.index, x.verdict]));
      judged.forEach((x, i) => { if (on(said[i]!)) shown.set(x.index, x.verdict); });
      const colour = (v?: string) => (v === 'PASS' ? C.pass : v === 'FAIL' ? C.fail : v === 'SKIP' ? C.skip : C.line);
      const culprit = data.timeline.find((x) => x.phase === 'confirm' && x.label === 'culprit')!.index;
      return (
        <Shell label="git bisect run, decided by Kane" badge="Each Kane run took 1.5 to 2.5 minutes · waits cut" caption={cap('S7', 1)}>
          <div style={{ marginTop: 20, display: 'flex', gap: 6 }}>
            {Array.from({ length: data.commitCount }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 74, borderRadius: 5, background: colour(shown.get(i)), outline: i === culprit && on(6.6) ? `4px solid ${C.text}` : 'none' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: C.dim, marginTop: 12 }}>
            <span>v1.0</span>
            <span>{data.commitCount} commits · {judged.length} bisect verdicts from Kane, {bisect.length - judged.length} skips</span>
            <span>HEAD</span>
          </div>
          <Terminal lines={r.bisect.map((l, i) => (on(said[i]!) ? l : ' '))} size={25} style={{ marginTop: 50 }} />
          <div style={{ textAlign: 'center', fontSize: 34, color: C.dim, marginTop: 40, opacity: fade(7.9) }}>Kane's reading → exit code → git bisect's next commit</div>
        </Shell>
      );
    }
    case 'S8':
      return (
        <Shell label="The first bad commit, confirmed" badge="Recorded run · real share pages, logged out" caption={cap('S8', 1)}>
          <div style={{ textAlign: 'center', opacity: fade(1.6) }}>
            <div style={{ fontSize: 34, color: C.dim }}>first bad commit</div>
            <div style={{ fontFamily: MONO, fontSize: 58, fontWeight: 700 }}>
              <span style={{ color: C.fail }}>fc2879c</span> refactor(cart): extract price helpers
            </div>
          </div>
          {!still && t < 8.0 ? (
            // How it got here: the history, with every verdict and the commit just named.
            <div style={{ marginTop: 90, opacity: fade(2.4) }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({ length: data.commitCount }, (_, i) => {
                  const hit = data.timeline.find((x) => x.index === i && (x.phase === 'bracket' || x.phase === 'bisect'));
                  const culprit = data.timeline.some((x) => x.index === i && x.phase === 'confirm' && x.label === 'culprit');
                  const colour = hit?.verdict === 'PASS' ? C.pass : hit?.verdict === 'FAIL' ? C.fail : hit?.verdict === 'SKIP' ? C.skip : C.line;
                  return <div key={i} style={{ flex: 1, height: 110, borderRadius: 5, background: colour, outline: culprit ? `6px solid ${C.text}` : 'none' }} />;
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: C.dim, marginTop: 14 }}>
                <span>v1.0</span>
                <span><span style={{ color: C.skip }}>3 skipped</span> · <span style={{ color: C.pass }}>pass</span> · <span style={{ color: C.fail }}>fail</span></span>
                <span>HEAD</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 28, textAlign: 'center', marginTop: 90, whiteSpace: 'pre-wrap', opacity: fade(5.2) }}>{r.named.trim()}</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 60, justifyContent: 'center', marginTop: 34 }}>
                {([['Run #12 · culprit fc2879c', 'preview/share-12.png', 'FAIL', C.fail, 11.3], ['Run #13 · parent df01b19', 'preview/share-13.png', 'PASS', C.pass, 13.8]] as const).map(([title, src, verdict, colour, at]) => (
                  <div key={src} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 30, marginBottom: 10 }}>{title}</div>
                    <div style={{ position: 'relative', border: `5px solid ${on(at) ? colour : C.line}`, borderRadius: 14, overflow: 'hidden', width: 731, height: 366 }}>
                      {on(at) ? null : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: C.dim }}>re-testing…</div>}
                      <div style={{ opacity: fade(at) }}><CartCrop src={src} scale={1.7} /></div>
                    </div>
                    <div style={{ fontSize: 48, fontWeight: 700, color: colour, marginTop: 8, opacity: fade(at + 0.9) }}>{verdict}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 23, color: C.dim, textAlign: 'center', marginTop: 22, opacity: fade(16.0) }}>{r.result}</div>
            </>
          )}
        </Shell>
      );
    case 'S9': {
      const items: [string, number][] = [
        [`· The check: expect ${data.check.expected}`, 4.6],
        ['· What Kane saw on HEAD: $20.00', 5.1],
        ["· Kane's summary of the failing run", 6.4],
        ['· First bad commit: fc2879c; its parent passes', 7.2],
        ["· The culprit's diff", 7.6],
      ];
      return (
        <Shell label="Kane's failure becomes the agent's brief" badge="From the recorded run" caption={cap('S9', 3)}>
          <div style={{ display: 'flex', gap: 30 }}>
            <div style={{ width: 900, background: C.panel, borderRadius: 12, padding: '18px 14px' }}>
              <div style={{ fontSize: 28, margin: '0 10px 12px' }}>The culprit's diff · pricing.js</div>
              <Diff lines={data.culpritDiff} size={18} mark="toLowerCase" />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>
              <div style={{ background: C.panel, borderRadius: 12, padding: '22px 30px', fontSize: 28, lineHeight: 1.65 }}>
                <div style={{ color: C.dim, fontSize: 24 }}>Brief outline (src/fix.ts), this run's values</div>
                {items.map(([text, at]) => <div key={text} style={{ opacity: fade(at) }}>{text}</div>)}
                <div style={{ color: C.dim, fontSize: 24, marginTop: 8, opacity: fade(9.1) }}>Agent: Claude Code, headless, Read / Edit / Write / Glob / Grep only</div>
              </div>
              <div style={{ background: C.panel, borderRadius: 12, padding: '20px 14px', opacity: still ? (phase === 0 ? 0.25 : 1) : fade(11.9) }}>
                <div style={{ fontSize: 28, margin: '0 10px 10px' }}>Claude's fix · one line</div>
                <Diff lines={data.fixDiff.filter((l) => /^[-+]/.test(l))} size={20} mark="Case" />
              </div>
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 24, color: C.accent, marginTop: 14, opacity: fade(1.5) }}>{r.handoff.trim()}</div>
        </Shell>
      );
    }
    case 'S10':
      return !secondLayout(12.4) ? (
        <Shell label="Kane Test Manager · run #14 (patched tree)" badge={SHARE} caption={cap('S10')}>
          <Share t={t} name="s10-share" still="share-14.png" play={0.1} hold={9.2} push={9.6} />
        </Shell>
      ) : (
        <Shell label="Only a Kane pass is committed" badge={REPLAY} caption={cap('S10', 3)}>
          <Terminal lines={[r.handoff, on(13.0) ? r.fixRun : ' ', on(13.9) ? r.verified : ' ']} size={27} style={{ marginTop: 60 }} />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 50, marginTop: 90, fontSize: 90, fontWeight: 700 }}>
            <span style={{ color: C.fail }}>$20.00</span><span style={{ color: C.dim }}>→</span><span style={{ color: C.pass }}>$18.00</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 34, color: C.dim, marginTop: 50, opacity: fade(17.4) }}>A fail goes back to the agent, up to 3 attempts · firstbad never pushes</div>
        </Shell>
      );
    case 'S11':
      return (
        <Shell label="The report" badge="docs/demo/recorded-run/report.md" caption={cap('S11')}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 23, lineHeight: 1.45 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: 'left' }}>{['#', 'Phase', 'Commit', 'Subject', 'Verdict', 'Observed', 'Kane link'].map((h) => <th key={h} style={{ padding: '4px 12px' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.timeline.map((x) => (
                <tr key={x.n} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: '3px 12px' }}>{x.n}</td>
                  <td style={{ padding: '3px 12px' }}>{x.phase}</td>
                  <td style={{ padding: '3px 12px', fontFamily: MONO }}>{x.sha}</td>
                  <td style={{ padding: '3px 12px' }}>{x.subject}</td>
                  <td style={{ padding: '3px 12px', fontWeight: 700, color: x.verdict === 'PASS' ? C.pass : x.verdict === 'FAIL' ? C.fail : C.skip }}>{x.verdict}</td>
                  <td style={{ padding: '3px 12px' }}>{x.observed ?? '-'}</td>
                  <td style={{ padding: '3px 12px', color: C.accent }}>{x.hasLink ? 'share page' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'center', fontSize: 46, fontWeight: 700, marginTop: 36, opacity: fade(1.4) }}>
            {data.cost.kaneRuns} Kane runs · {data.wallMinutes} minutes · about 200 credits by balance
          </div>
        </Shell>
      );
    case 'S12':
      return (
        <Shell label=" " caption={cap('S12')}>
          <div style={{ textAlign: 'center', marginTop: 30 }}>
            <div style={{ fontSize: 120, fontWeight: 700 }}>firstbad</div>
            <div style={{ fontFamily: MONO, fontSize: 46, color: C.accent, marginTop: 16 }}>github.com/Dotman-Bei/firstbad</div>
            <Img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.qrSvg)}`} style={{ width: 300, height: 300, display: 'block', margin: '40px auto' }} />
            <div style={{ fontSize: 34 }}>Built at KaneCLI Online Hackathon 2026</div>
            <div style={{ fontSize: 28, color: C.dim, marginTop: 10 }}>Recorded run: docs/demo/recorded-run/</div>
          </div>
        </Shell>
      );
    default:
      return null;
  }
};
