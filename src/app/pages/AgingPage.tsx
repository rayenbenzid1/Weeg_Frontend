// src/app/pages/AgingReceivablePage.tsx

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, RefreshCw, Loader2, AlertCircle, Download,
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { useAgingReport, useAgingDates, type AgingRow } from '../lib/dataHooks';
import { formatCurrency } from '../lib/utils';
import { DataTable } from '../components/DataTable';

// ── Normalize ─────────────────────────────────────────────────────────────────
function normalizeRow(r: AgingRow): AgingRow {
  const num = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0; };
  return {
    ...r,
    current: num(r.current), d1_30: num(r.d1_30), d31_60: num(r.d31_60),
    d61_90: num(r.d61_90), d91_120: num(r.d91_120), d121_150: num(r.d121_150),
    d151_180: num(r.d151_180), d181_210: num(r.d181_210), d211_240: num(r.d211_240),
    d241_270: num(r.d241_270), d271_300: num(r.d271_300), d301_330: num(r.d301_330),
    over_330: num(r.over_330), total: num(r.total), overdue_total: num(r.overdue_total),
    customer_name: r.customer_name || r.account || null,
  };
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  cyan:    '#0ea5e9',
  teal:    '#14b8a6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  orange:  '#f97316',
  rose:    '#f43f5e',
};

const css = {
  card:    'hsl(var(--card))',
  cardFg:  'hsl(var(--card-foreground))',
  border:  'hsl(var(--border))',
  muted:   'hsl(var(--muted))',
  mutedFg: 'hsl(var(--muted-foreground))',
  bg:      'hsl(var(--background))',
  fg:      'hsl(var(--foreground))',
};

const cardStyle: React.CSSProperties = {
  background:   css.card,
  borderRadius: 16,
  padding:      24,
  boxShadow:    '0 1px 3px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.05)',
  border:       `1px solid ${css.border}`,
};

const axisStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

// ── Constants ─────────────────────────────────────────────────────────────────
const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: 'Low',      color: C.emerald, bg: `${C.emerald}18` },
  medium:   { label: 'Medium',   color: C.amber,   bg: `${C.amber}18`   },
  high:     { label: 'High',     color: C.orange,  bg: `${C.orange}18`  },
  critical: { label: 'Critical', color: C.rose,    bg: `${C.rose}18`    },
};

const BUCKETS: { key: keyof AgingRow; label: string }[] = [
  { key: 'current',  label: 'Current'  }, { key: 'd1_30',    label: '1-30d'    },
  { key: 'd31_60',   label: '31-60d'   }, { key: 'd61_90',   label: '61-90d'   },
  { key: 'd91_120',  label: '91-120d'  }, { key: 'd121_150', label: '121-150d' },
  { key: 'd151_180', label: '151-180d' }, { key: 'd181_210', label: '181-210d' },
  { key: 'd211_240', label: '211-240d' }, { key: 'd241_270', label: '241-270d' },
  { key: 'd271_300', label: '271-300d' }, { key: 'd301_330', label: '301-330d' },
  { key: 'over_330', label: '>330d'    },
];

const BUCKET_COLORS = [
  '#10b981','#34d399','#fbbf24','#f59e0b',
  '#f97316','#ef4444','#dc2626','#b91c1c',
  '#991b1b','#7f1d1d','#6b21a8','#581c87','#3b0764',
];

const PERIOD_OPTIONS = [
  { key: 'all',  label: 'All Periods'    },
  { key: '30',   label: 'Last 30 Days'   },
  { key: '90',   label: 'Last 90 Days'   },
  { key: '180',  label: 'Last 6 Months'  },
  { key: '365',  label: 'Last 12 Months' },
];

const RISK_OPTIONS = [
  { key: 'all',      label: 'All Risk Levels' },
  { key: 'low',      label: 'Low'             },
  { key: 'medium',   label: 'Medium'          },
  { key: 'high',     label: 'High'            },
  { key: 'critical', label: 'Critical'        },
];

// ── StyledDropdown ─────────────────────────────────────────────────────────────
function StyledDropdown({
  label, options, value, onChange, isOpen, onToggle, onClose, minWidth,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  minWidth?: number;
}) {
  const ref    = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const current = options.find(o => o.key === value)?.label ?? label;

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, width: rect.width });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose]);

  const menu = isOpen ? createPortal(
    <div style={{
      position: 'absolute', top: menuPos.top, left: menuPos.left,
      width: Math.max(menuPos.width, minWidth ?? 0),
      zIndex: 9999, background: '#ffffff', border: '1px solid #e5e7eb',
      borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      maxHeight: 280, overflowY: 'auto', padding: 6,
    }}>
      {options.map(opt => (
        <button key={opt.key} onMouseDown={e => e.stopPropagation()}
          onClick={() => { onChange(opt.key); onClose(); }}
          style={{
            width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8,
            border: 'none', cursor: 'pointer', fontSize: 13,
            background: value === opt.key ? `${C.indigo}15` : 'transparent',
            color: value === opt.key ? C.indigo : '#111827',
            fontWeight: value === opt.key ? 600 : 400,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          {opt.label}
          {value === opt.key && <span style={{ color: C.indigo, fontSize: 12 }}>✓</span>}
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: minWidth ?? 160 }}>
      {label && (
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, marginBottom: 6 }}>
          {label}
        </p>
      )}
      <button ref={btnRef} onClick={onToggle} style={{
        width: '100%', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', borderRadius: 10, border: `1px solid ${css.border}`,
        background: css.card, color: css.cardFg, fontSize: 13, cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
        <ChevronDownIcon size={14} style={{ flexShrink: 0, marginLeft: 8, color: css.mutedFg, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {menu}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: accent, opacity: 0.08, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color: css.cardFg, margin: '4px 0 0', letterSpacing: '-0.03em' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>{title}</h3>
        {sub && <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Chart Tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontSize: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill ?? p.color, display: 'inline-block' }} />
          <span style={{ color: '#6b7280' }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', paddingLeft: 16, fontWeight: 700, color: '#111827' }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function AgingReceivablePage() {
  const { data: datesData }             = useAgingDates();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [period, setPeriod]             = useState<string>('all');
  const [riskFilter, setRiskFilter]     = useState<string>('all');
  const [openDropdown, setOpenDropdown] = useState<'period' | 'date' | 'risk' | null>(null);

  const reportDate = selectedDate || datesData?.dates?.[0] || '';

  const { data: agingData, loading, error, refetch } = useAgingReport({
    report_date: reportDate || undefined,
    limit: 500,
  });

  const rows: AgingRow[] = useMemo(
    () => (agingData?.results ?? []).filter(r => Number(r.total) > 0).map(normalizeRow),
    [agingData],
  );

  const totalAccounts: number = (agingData as any)?.total_accounts ?? 0;

  const totals = useMemo(() => ({
    total:   rows.reduce((s, r) => s + r.total,         0),
    overdue: rows.reduce((s, r) => s + r.overdue_total, 0),
    current: rows.reduce((s, r) => s + r.current,       0),
  }), [rows]);

  const riskCounts = useMemo(() => {
    const c: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    rows.forEach(r => { c[r.risk_score] = (c[r.risk_score] ?? 0) + 1; });
    return c;
  }, [rows]);

  const bucketTotals = useMemo(() =>
    BUCKETS.map((b, i) => ({
      label:  b.label,
      amount: rows.reduce((s, r) => s + ((r[b.key] as number) || 0), 0),
      color:  BUCKET_COLORS[i],
    })).filter(b => b.amount > 0),
  [rows]);

  const pieData = useMemo(() =>
    Object.entries(riskCounts).filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: RISK_CONFIG[k].label, value: v, color: RISK_CONFIG[k].color })),
  [riskCounts]);

  const dateOptions = [
    { key: '__latest__', label: 'Latest available' },
    ...(datesData?.dates ?? []).map(d => ({ key: d, label: d })),
  ];

  // ── Filtered rows for DataTable ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...rows];
    if (riskFilter !== 'all') data = data.filter(r => r.risk_score === riskFilter);
    return data;
  }, [rows, riskFilter]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Code', 'Customer', ...BUCKETS.map(b => b.label), 'Total', 'Overdue', 'Risk'];
    const csvRows = filtered.map(r => [
      r.account_code,
      `"${(r.customer_name ?? r.account ?? '').replace(/"/g, '""')}"`,
      ...BUCKETS.map(b => ((r[b.key] as number) || 0).toFixed(2)),
      r.total.toFixed(2), r.overdue_total.toFixed(2),
      RISK_CONFIG[r.risk_score]?.label ?? r.risk_score,
    ].join(','));
    const csv  = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `aging_receivables_${reportDate || 'latest'}.csv`,
    });
    a.click();
  };

  // ── DataTable columns — Transactions style ────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: AgingRow) => (
        <div style={{ maxWidth: 200 }}>
          <p style={{ fontWeight: 600, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: css.cardFg }}
             title={row.customer_name ?? row.account ?? ''}>
            {row.customer_name || row.account || '—'}
          </p>
          <p style={{ fontSize: 11, color: css.mutedFg, fontFamily: 'monospace', margin: 0 }}>
            {row.account_code}
          </p>
        </div>
      ),
    },
    // Bucket columns
    ...BUCKETS.map((b, i) => ({
      key: b.key as string,
      label: b.label,
      render: (row: AgingRow) => {
        const val       = (row[b.key] as number) || 0;
        const isOverdue = i >= 3;
        const color     = val === 0
          ? css.mutedFg
          : isOverdue
            ? C.rose
            : i > 0
              ? C.amber
              : C.emerald;
        return val > 0
          ? <span style={{ color, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{formatCurrency(val)}</span>
          : <span style={{ color: css.mutedFg, fontSize: 12 }}>—</span>;
      },
    })),
    {
      key: 'total',
      label: 'Total',
      render: (row: AgingRow) => (
        <span style={{ fontWeight: 800, fontSize: 13, color: css.cardFg, whiteSpace: 'nowrap' }}>
          {formatCurrency(row.total)}
        </span>
      ),
    },
    {
      key: 'overdue_total',
      label: 'Overdue',
      render: (row: AgingRow) => (
        row.overdue_total > 0
          ? <span style={{ color: C.rose, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{formatCurrency(row.overdue_total)}</span>
          : <span style={{ color: css.mutedFg, fontSize: 12 }}>—</span>
      ),
    },
    {
      key: 'risk_score',
      label: 'Risk',
      render: (row: AgingRow) => {
        const cfg = RISK_CONFIG[row.risk_score] ?? RISK_CONFIG.low;
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 8px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}35`,
          }}>
            {cfg.label}
          </span>
        );
      },
    },
  ], []);

  return (
    <div style={{ background: css.bg, minHeight: '100vh', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: css.fg, letterSpacing: '-0.03em', margin: 0 }}>
            Accounts Receivable Aging
          </h1>
          <p style={{ fontSize: 13, color: css.mutedFg, marginTop: 4 }}>
            Receivables breakdown by age bucket and customer risk assessment
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} disabled={filtered.length === 0} style={{
            display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
            borderRadius: 10, border: `1px solid ${css.border}`, background: css.card,
            color: css.cardFg, fontSize: 13, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
            opacity: filtered.length === 0 ? 0.5 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={refetch} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
            borderRadius: 10, border: `1px solid ${css.border}`, background: css.card,
            color: css.cardFg, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Filters</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>Customize your receivables view</p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StyledDropdown label="Period"      options={PERIOD_OPTIONS} value={period}                       onChange={v => setPeriod(v)}                                    isOpen={openDropdown === 'period'} onToggle={() => setOpenDropdown(o => o === 'period' ? null : 'period')} onClose={() => setOpenDropdown(null)} />
          <StyledDropdown label="Report Date" options={dateOptions}    value={selectedDate || '__latest__'} onChange={v => setSelectedDate(v === '__latest__' ? '' : v)}     isOpen={openDropdown === 'date'}   onToggle={() => setOpenDropdown(o => o === 'date'   ? null : 'date')}   onClose={() => setOpenDropdown(null)} />
          <StyledDropdown label="Risk Level"  options={RISK_OPTIONS}   value={riskFilter}                  onChange={v => setRiskFilter(v)}                                 isOpen={openDropdown === 'risk'}   onToggle={() => setOpenDropdown(o => o === 'risk'   ? null : 'risk')}   onClose={() => setOpenDropdown(null)} />
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, color: C.rose }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: 13, flex: 1 }}>{error}</span>
          <button onClick={refetch} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid ${css.border}`, background: css.card, color: css.cardFg, fontSize: 12, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12, color: css.mutedFg }}>
          <Loader2 size={20} className="animate-spin" style={{ color: C.indigo }} />
          <span style={{ fontSize: 14 }}>Loading aging report…</span>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12 }}>
          <AlertCircle size={40} style={{ color: css.mutedFg, opacity: 0.4 }} />
          <p style={{ fontSize: 14, color: css.mutedFg }}>No aging data available</p>
          <button onClick={refetch} style={{ height: 34, padding: '0 16px', borderRadius: 8, border: `1px solid ${css.border}`, background: css.card, color: css.cardFg, fontSize: 13, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            <KpiCard label="Total Receivables"  value={formatCurrency(totals.total)}   icon={TrendingUp}    accent={C.indigo}
              sub={totalAccounts > 0 ? `${rows.length} active · ${totalAccounts} total accounts` : `${rows.length} customers with open balance`} />
            <KpiCard label="Current (not due)"  value={formatCurrency(totals.current)} icon={CheckCircle2}  accent={C.emerald}
              sub={totals.total > 0 ? `${((totals.current / totals.total) * 100).toFixed(1)}% of total` : undefined} />
            <KpiCard label="Overdue (>60d)"     value={formatCurrency(totals.overdue)} icon={AlertTriangle} accent={C.rose}
              sub={totals.total > 0 ? `${((totals.overdue / totals.total) * 100).toFixed(1)}% of total` : undefined} />
            <KpiCard label="At-Risk Customers"  value={`${(riskCounts.high ?? 0) + (riskCounts.critical ?? 0)}`} icon={Clock} accent={C.orange}
              sub={`${riskCounts.critical ?? 0} critical · ${riskCounts.high ?? 0} high`} />
          </div>

          {/* ── Charts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

            {/* Bar chart */}
            <Panel title="Receivables by Age Bucket" sub="Aggregated amounts (LYD)">
              {bucketTotals.length === 0 ? (
                <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.mutedFg, fontSize: 13 }}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={bucketTotals} margin={{ left: 5, right: 5, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={css.border} vertical={false} />
                    <XAxis dataKey="label" tick={axisStyle} angle={-30} textAnchor="end" height={50} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="amount" name="Amount" radius={[5, 5, 0, 0]}>
                      {bucketTotals.map((_, i) => <Cell key={i} fill={bucketTotals[i].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            {/* Donut — Risk distribution */}
            <div style={cardStyle}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Risk Distribution</h3>
                <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
                  {rows.length} active{totalAccounts > 0 ? ` of ${totalAccounts} total` : ''}
                </p>
              </div>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} customers`, '']} contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                {Object.entries(RISK_CONFIG).map(([key, cfg]) => {
                  const count = riskCounts[key] ?? 0;
                  const total = rows.length;
                  const pct   = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: css.cardFg }}>{cfg.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: css.mutedFg }}>{pct.toFixed(0)}%</span>
                          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 28, textAlign: 'center', padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}35` }}>
                            {count}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.color}70, ${cfg.color})`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Customer Table — DataTable style (same as TransactionsPage) ── */}
          <div style={cardStyle}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Customer Detail</h3>
              <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
                {filtered.length} active{totalAccounts > 0 ? ` of ${totalAccounts} total accounts` : ''}
                {reportDate && <span style={{ color: C.indigo }}> · Report: {reportDate}</span>}
              </p>
            </div>

            {/* Risk legend — same as category legend in TransactionsPage */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: css.mutedFg }}>Risk:</span>
              {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
                <span key={key} style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '2px 8px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}35`,
                }}>
                  {cfg.label}
                </span>
              ))}
            </div>

            <DataTable
              data={filtered}
              columns={columns}
              searchable
              exportable={false}   /* export handled by header button */
              pageSize={20}
            />
          </div>
        </>
      )}
    </div>
  );
}