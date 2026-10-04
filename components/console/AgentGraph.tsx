'use client';

import { motion } from 'motion/react';
import {
  ArrowRight,
  AudioLines,
  BellRing,
  Building2,
  Cpu,
  HeartHandshake,
  PhoneOutgoing,
  ScanText,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react';
import { NODE_KIND, type NodeId, type NodeKind } from './format';

type NodeDef = { id: NodeId; x: number; y: number; w: number; h: number; title: string; sub: string; icon: LucideIcon };

const W = 170;
const H = 64;

function nodes(recipientFirst: string, caregivers: string, clinicMode: string): NodeDef[] {
  return [
    { id: 'meera', x: 95, y: 82, w: W, h: H, title: recipientFirst, sub: 'Talks or taps', icon: User },
    { id: 'nami', x: 355, y: 82, w: W, h: H, title: 'Nami', sub: 'Voice agent · tools', icon: AudioLines },
    { id: 'engine', x: 545, y: 250, w: 214, h: 96, title: 'Workflow engine', sub: 'Deterministic code', icon: Cpu },
    { id: 'caller', x: 735, y: 82, w: W, h: H, title: 'Caller agent', sub: 'Speaks for Meera', icon: PhoneOutgoing },
    { id: 'clinic', x: 965, y: 82, w: W, h: H, title: 'Clinic', sub: clinicMode === 'phone' ? 'Real phone call' : 'Simulated / phone', icon: Building2 },
    { id: 'extractor', x: 965, y: 250, w: W, h: H, title: 'Extractor', sub: 'Transcript → JSON', icon: ScanText },
    { id: 'verifier', x: 790, y: 418, w: W, h: H, title: 'Verifier', sub: 'Slot · consent · data', icon: ShieldCheck },
    { id: 'family', x: 355, y: 418, w: W, h: H, title: 'Family alert', sub: 'Link · QR · phone', icon: BellRing },
    { id: 'caregiver', x: 95, y: 418, w: W, h: H, title: 'Caregiver', sub: caregivers, icon: HeartHandshake },
  ];
}

type EdgeDef = { from: NodeId; to: NodeId; label: string; bend?: number; both?: boolean; lx?: number; ly?: number };

const EDGES: EdgeDef[] = [
  { from: 'meera', to: 'nami', label: 'voice · taps', both: true },
  { from: 'nami', to: 'engine', label: 'tool call ⇄ result', both: true, bend: -30 },
  { from: 'engine', to: 'caller', label: 'outbox: place call', bend: -30 },
  { from: 'caller', to: 'clinic', label: 'call', both: true },
  { from: 'caller', to: 'extractor', label: 'transcript', bend: 26 },
  { from: 'extractor', to: 'verifier', label: 'proposed slot', bend: 20 },
  { from: 'verifier', to: 'engine', label: 'pass / fail', bend: 24 },
  { from: 'engine', to: 'family', label: 'timer: escalate', bend: 26 },
  { from: 'family', to: 'caregiver', label: 'explicit yes?' },
  { from: 'caregiver', to: 'engine', label: 'accept · report', bend: -70 },
];

const STYLE: Record<NodeKind, { fill: string; stroke: string; badge: string; icon: string; title: string; sub: string; tag: string; tagFill: string; tagText: string; dash?: string }> = {
  llm: { fill: '#fffdf8', stroke: '#80a99b', badge: '#cfe0d8', icon: '#24564f', title: '#173d38', sub: '#4a5552', tag: 'LLM', tagFill: '#cfe0d8', tagText: '#24564f' },
  code: { fill: '#173d38', stroke: '#173d38', badge: '#24564f', icon: '#f7f3ea', title: '#f7f3ea', sub: '#cfe0d8', tag: 'CODE', tagFill: '#80a99b', tagText: '#173d38' },
  human: { fill: '#fffdf8', stroke: '#c49a7c', badge: '#f3e6dc', icon: '#8a6046', title: '#173d38', sub: '#4a5552', tag: 'HUMAN', tagFill: '#f3e6dc', tagText: '#8a6046' },
  external: { fill: '#efe8d9', stroke: '#b9b09c', badge: '#f7f3ea', icon: '#4a5552', title: '#1e2422', sub: '#4a5552', tag: 'EXTERNAL', tagFill: '#f7f3ea', tagText: '#4a5552', dash: '5 4' },
};

function geometry(a: NodeDef, b: NodeDef, bend = 0) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  // point where the curve leaves/enters each box, approximated by stepping along the curve
  const at = (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t ** 2 * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t ** 2 * b.y });
  const inside = (p: { x: number; y: number }, n: NodeDef, pad: number) => Math.abs(p.x - n.x) < n.w / 2 + pad && Math.abs(p.y - n.y) < n.h / 2 + pad;
  let t0 = 0;
  while (t0 < 0.5 && inside(at(t0), a, 6)) t0 += 0.01;
  let t1 = 1;
  while (t1 > 0.5 && inside(at(t1), b, 6)) t1 -= 0.01;
  // sub-curve between t0 and t1 (blossoming of the quadratic)
  const p0 = at(t0);
  const p2 = at(t1);
  const lerp = (u: number, v: number, t: number) => u + (v - u) * t;
  const qx = lerp(lerp(a.x, cx, t0), lerp(cx, b.x, t0), t1);
  const qy = lerp(lerp(a.y, cy, t0), lerp(cy, b.y, t0), t1);
  const label = at(0.5);
  return { d: `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`, label };
}

export function AgentGraph({
  active,
  live,
  recipientFirst,
  caregivers,
  clinicMode,
}: {
  active: Set<NodeId>;
  live: boolean;
  recipientFirst: string;
  caregivers: string;
  clinicMode: string;
}) {
  const defs = nodes(recipientFirst, caregivers, clinicMode);
  const byId = Object.fromEntries(defs.map((n) => [n.id, n])) as Record<NodeId, NodeDef>;
  const glow = live ? 1 : 0.55;

  return (
    <>
      {/* ------------------------------------------------ desktop / tablet: SVG graph */}
      <div className="hidden md:block">
        <svg viewBox="0 0 1060 470" className="h-auto w-full font-sans" role="img" aria-label="Agent graph: who talks to whom, and which parts are deterministic code">
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#b9b09c" />
            </marker>
            <marker id="arr-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#24564f" />
            </marker>
            <radialGradient id="engine-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#80a99b" stopOpacity=".35" />
              <stop offset="100%" stopColor="#80a99b" stopOpacity="0" />
            </radialGradient>
            <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.2" fill="#dcd6c8" />
            </pattern>
            <style>{`@keyframes namiflow{to{stroke-dashoffset:-28}} .flow{animation:namiflow 1.1s linear infinite} @media (prefers-reduced-motion: reduce){.flow{animation:none}}`}</style>
          </defs>
          <rect x="0" y="0" width="1060" height="470" fill="url(#dots)" opacity=".7" />
          <ellipse cx={byId.engine.x} cy={byId.engine.y} rx="210" ry="120" fill="url(#engine-halo)" />

          {/* edges */}
          {EDGES.map((e) => {
            const a = byId[e.from];
            const b = byId[e.to];
            const on = active.has(e.from) && active.has(e.to);
            const g = geometry(a, b, e.bend);
            const lw = e.label.length * 5.9 + 14;
            return (
              <g key={`${e.from}-${e.to}`}>
                <path d={g.d} fill="none" stroke={on ? '#24564f' : '#cfc7b6'} strokeWidth={on ? 2.6 : 1.6} markerEnd={`url(#${on ? 'arr-on' : 'arr'})`} markerStart={e.both ? `url(#${on ? 'arr-on' : 'arr'})` : undefined} />
                {on ? <path d={g.d} fill="none" stroke="#80a99b" strokeWidth={2.6} strokeDasharray="6 8" className="flow" opacity={glow} /> : null}
                <g transform={`translate(${g.label.x - lw / 2}, ${g.label.y - 10})`}>
                  <rect width={lw} height={20} rx={10} fill={on ? '#24564f' : '#f7f3ea'} stroke={on ? '#24564f' : '#dcd6c8'} />
                  <text x={lw / 2} y={14} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={on ? '#f7f3ea' : '#4a5552'}>
                    {e.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* nodes */}
          {defs.map((n) => {
            const kind = NODE_KIND[n.id];
            const s = STYLE[kind];
            const on = active.has(n.id);
            const Icon = n.icon;
            const isEngine = n.id === 'engine';
            const tagW = s.tag.length * 6.4 + 12;
            return (
              <g key={n.id} transform={`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`}>
                {on ? (
                  <motion.rect
                    x={-7}
                    y={-7}
                    width={n.w + 14}
                    height={n.h + 14}
                    rx={22}
                    fill="none"
                    stroke={kind === 'human' ? '#c49a7c' : '#80a99b'}
                    strokeWidth={3}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: live ? [0.35, 1, 0.35] : glow }}
                    transition={live ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                  />
                ) : null}
                <rect width={n.w} height={n.h} rx={16} fill={s.fill} stroke={on ? '#24564f' : s.stroke} strokeWidth={on ? 2 : 1.4} strokeDasharray={s.dash} filter={undefined} />
                <circle cx={28} cy={isEngine ? 34 : n.h / 2} r={16} fill={s.badge} />
                <Icon x={18} y={(isEngine ? 34 : n.h / 2) - 10} width={20} height={20} color={s.icon} strokeWidth={2} aria-hidden />
                <text x={54} y={isEngine ? 31 : n.h / 2 - 3} fontSize={isEngine ? 18 : 16} fontWeight={700} fill={s.title}>
                  {n.title}
                </text>
                <text x={54} y={isEngine ? 49 : n.h / 2 + 15} fontSize={12} fill={s.sub}>
                  {n.sub}
                </text>
                {isEngine ? (
                  <g transform="translate(14, 64)">
                    <rect width={n.w - 28} height={20} rx={10} fill="#24564f" />
                    <text x={(n.w - 28) / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#f7f3ea" letterSpacing=".02em">
                      the only writer of care state
                    </text>
                  </g>
                ) : null}
                <g transform={`translate(${n.w - tagW - 8}, -9)`}>
                  <rect width={tagW} height={18} rx={9} fill={s.tagFill} stroke={kind === 'code' ? '#173d38' : 'none'} strokeWidth={1} />
                  <text x={tagW / 2} y={12.5} textAnchor="middle" fontSize={9.5} fontWeight={800} letterSpacing=".08em" fill={s.tagText}>
                    {s.tag}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ------------------------------------------------ phone: two flows as chips */}
      <div className="space-y-5 md:hidden">
        <Flow title="Appointment (agentic)" ids={['meera', 'nami', 'engine', 'caller', 'clinic', 'extractor', 'verifier', 'engine']} defs={byId} active={active} />
        <Flow title="Safety net (check-in / help)" ids={['engine', 'family', 'caregiver', 'engine']} defs={byId} active={active} />
      </div>
    </>
  );
}

const CHIP: Record<NodeKind, string> = {
  llm: 'bg-card text-teal-900 ring-sea-500',
  code: 'bg-teal-900 text-ivory-50 ring-teal-900',
  human: 'bg-card text-teal-900 ring-cocoa-300',
  external: 'bg-ivory-100 text-ink-900 ring-line',
};

function Flow({ title, ids, defs, active }: { title: string; ids: NodeId[]; defs: Record<NodeId, NodeDef>; active: Set<NodeId> }) {
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-[.14em] text-ink-600">{title}</p>
      <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2">
        {ids.map((id, i) => {
          const n = defs[id];
          const on = active.has(id);
          return (
            <li key={`${id}-${i}`} className="flex items-center gap-1">
              <span
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold ring-1 transition ${CHIP[NODE_KIND[id]]} ${
                  on ? 'shadow-[0_0_0_4px_rgba(128,169,155,.45)]' : 'opacity-90'
                }`}
              >
                <n.icon className="size-4" aria-hidden />
                {n.title}
              </span>
              {i < ids.length - 1 ? <ArrowRight className="size-4 text-ink-600/60" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function GraphLegend() {
  const items: Array<{ kind: NodeKind; text: string }> = [
    { kind: 'llm', text: 'LLM — proposes' },
    { kind: 'code', text: 'Code — disposes' },
    { kind: 'human', text: 'Human' },
    { kind: 'external', text: 'External' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-600">
      {items.map((i) => (
        <li key={i.kind} className="flex items-center gap-2">
          <span className={`inline-block size-3.5 rounded-[5px] ring-[1.5px] ${CHIP[i.kind]}`} aria-hidden />
          {i.text}
        </li>
      ))}
    </ul>
  );
}
