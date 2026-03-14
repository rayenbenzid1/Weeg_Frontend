// src/app/pages/KPIEnginePage.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  TrendingUp, Package, DollarSign, BarChart3,
  Info, RefreshCw, Loader2, ChevronDown, ArrowUpRight,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { CreditKPISection } from '../components/CreditKPISection';
import { SalesKPISection } from '../components/SalesKPISection';
import { StockKPISection } from '../components/StockKPISection';
import {
  MOVEMENT_TYPES,
  useTransactionSummary,
  useBranchBreakdown,
  useTypeBreakdown,
  useBranchMonthly,
  useInventorySnapshots,
  useAgingList,
  type MonthlySummaryItem,
} from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

// ── Brand palette ──────────────────────────────────────────────────────────

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

const BRANCH_COLORS = [C.indigo, C.cyan, C.teal, C.emerald, C.amber, C.rose, C.violet];

// ── CSS-variable-based helpers ─────────────────────────────────────────────

const css = {
  card:      'hsl(var(--card))',
  cardFg:    'hsl(var(--card-foreground))',
  border:    'hsl(var(--border))',
  muted:     'hsl(var(--muted))',
  mutedFg:   'hsl(var(--muted-foreground))',
  bg:        'hsl(var(--background))',
  fg:        'hsl(var(--foreground))',
};

const cardStyle: React.CSSProperties = {
  background:   css.card,
  borderRadius: 16,
  padding:      24,
  boxShadow:    '0 1px 3px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.05)',
  border:       `1px solid ${css.border}`,
};

const axisStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const legendStyle = { fontSize: 12, color: 'hsl(var(--muted-foreground))', paddingTop: 8 };

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: css.card, border: `1px solid ${css.border}`, borderRadius: 12,
      padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      fontSize: 12, minWidth: 220, maxWidth: 300,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: css.cardFg, paddingBottom: 8, borderBottom: `1px solid ${css.border}`, margin: '0 0 8px 0' }}>
        {label}
      </p>
      <div style={{ marginTop: 10 }}>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i > 0 ? 8 : 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.fill ?? p.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: css.mutedFg, flex: 1 }}>{p.name}</span>
            <span style={{ fontWeight: 700, color: css.cardFg }}>
              {typeof p.value === 'number' ? formatCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Loader / Empty ─────────────────────────────────────────────────────────

function Loader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: css.mutedFg }}>
      <Loader2 size={15} className="animate-spin" />
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}

function Empty({ height = 120 }: { height?: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.mutedFg, fontSize: 13 }}>
      No data available
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KPI({
  title, value, icon: Icon, accent, sub, trend,
}: {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  accent: string;
  sub?: string;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden', borderTop: `3px solid ${accent}`, paddingTop: 20 }}>
      <div style={{ position: 'absolute', bottom: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: accent, opacity: 0.06, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: `${accent}15`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700,
          color: trend?.isPositive === false ? C.rose : C.emerald,
          background: trend?.isPositive === false ? `${C.rose}12` : `${C.emerald}12`,
          border: `1px solid ${trend?.isPositive === false ? C.rose : C.emerald}25`,
          padding: '3px 8px', borderRadius: 20,
        }}>
          <ArrowUpRight size={10} />
          {trend ? `${trend.value.toFixed(1)}%` : '—'}
        </div>
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>{title}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: css.cardFg, marginTop: 5, marginBottom: 4, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: css.mutedFg, marginBottom: 14 }}>{sub}</p>}
      {!sub && <div style={{ marginBottom: 14 }} />}
      <div style={{ height: 3, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: '64%', background: `linear-gradient(90deg, ${accent}60, ${accent})` }} />
      </div>
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

function Panel({ title, sub, children, action }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>{title}</h3>
          {sub && <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 800, color: css.fg, letterSpacing: '-0.02em', margin: '0 0 16px 0' }}>
      {title}
    </h2>
  );
}

// ── Period helpers ─────────────────────────────────────────────────────────

type PeriodKey = 'last_month' | 'last_3' | 'last_6' | 'last_12' | 'ytd';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3',     label: 'Last 3 Months' },
  { key: 'last_6',     label: 'Last 6 Months' },
  { key: 'last_12',    label: 'Last 12 Months' },
  { key: 'ytd',        label: 'Year to Date' },
];

function periodToDates(key: PeriodKey): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateTo = fmt(today);

  if (key === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last  = new Date(today.getFullYear(), today.getMonth(), 0);
    return { dateFrom: fmt(first), dateTo: fmt(last) };
  }
  if (key === 'last_3') {
    const from = new Date(today); from.setMonth(from.getMonth() - 3);
    return { dateFrom: fmt(from), dateTo };
  }
  if (key === 'last_6') {
    const from = new Date(today); from.setMonth(from.getMonth() - 6);
    return { dateFrom: fmt(from), dateTo };
  }
  if (key === 'last_12') {
    const from = new Date(today); from.setFullYear(from.getFullYear() - 1);
    return { dateFrom: fmt(from), dateTo };
  }
  return { dateFrom: `${today.getFullYear()}-01-01`, dateTo };
}

// ── StyledDropdown ─────────────────────────────────────────────────────────

function StyledDropdown({
  label, options, value, onChange, isOpen, onToggle, onClose,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
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
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  const menu = isOpen ? createPortal(
    <div style={{
      position: 'absolute', top: menuPos.top, left: menuPos.left, width: menuPos.width,
      zIndex: 9999, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: 280, overflowY: 'auto', padding: 6,
    }}>
      {options.map(opt => (
        <button
          key={opt.key}
          onMouseDown={e => e.stopPropagation()}
          onClick={() => { onChange(opt.key); onClose(); }}
          style={{
            width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8,
            border: 'none', cursor: 'pointer', fontSize: 13,
            background: value === opt.key ? `${C.indigo}15` : 'transparent',
            color:      value === opt.key ? C.indigo : '#111827',
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
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, marginBottom: 6 }}>
        {label}
      </p>
      <button
        ref={btnRef}
        onClick={onToggle}
        style={{
          width: '100%', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', borderRadius: 10, border: `1px solid ${css.border}`,
          background: css.card, color: css.cardFg, fontSize: 13, cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: 8, color: css.mutedFg, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {menu}
    </div>
  );
}

// ── FilterBar ──────────────────────────────────────────────────────────────

function FilterBar({
  period, onPeriodChange, branch, onBranchChange, branches,
}: {
  period: PeriodKey;
  onPeriodChange: (k: PeriodKey) => void;
  branch: string;
  onBranchChange: (b: string) => void;
  branches: string[];
}) {
  const [openDropdown, setOpenDropdown] = useState<'period' | 'branch' | null>(null);

  const branchOptions = [
    { key: '', label: 'All Branches' },
    ...branches.map(b => ({ key: b, label: b })),
  ];

  return (
    <Panel title="Filters" sub="Customize your view — all charts update automatically">
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <StyledDropdown
          label="Period"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={v => onPeriodChange(v as PeriodKey)}
          isOpen={openDropdown === 'period'}
          onToggle={() => setOpenDropdown(o => o === 'period' ? null : 'period')}
          onClose={() => setOpenDropdown(null)}
        />
        <StyledDropdown
          label="Branch"
          options={branchOptions}
          value={branch}
          onChange={onBranchChange}
          isOpen={openDropdown === 'branch'}
          onToggle={() => setOpenDropdown(o => o === 'branch' ? null : 'branch')}
          onClose={() => setOpenDropdown(null)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ height: 6 + 11 + 6 }} />
          <button
            onClick={() => { onPeriodChange('ytd'); onBranchChange(''); }}
            disabled={period === 'ytd' && !branch}
            style={{
              height: 38, padding: '0 18px', borderRadius: 10,
              border: `1px solid ${css.border}`, background: css.card,
              color: css.cardFg, fontSize: 13, cursor: 'pointer',
              opacity: period === 'ytd' && !branch ? 0.45 : 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', whiteSpace: 'nowrap',
            }}
          >
            Reset filters
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ── ActiveFilterBadge — visual feedback when filters are active ────────────

function ActiveFilterBadge({ period, branch }: { period: PeriodKey; branch: string }) {
  const periodLabel = PERIOD_OPTIONS.find(o => o.key === period)?.label ?? period;
  const isDefault   = period === 'ytd' && !branch;
  if (isDefault) return null;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: `${C.indigo}10`, border: `1px solid ${C.indigo}25`,
      borderRadius: 20, padding: '4px 12px', marginBottom: 16,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.indigo, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: C.indigo, fontWeight: 600 }}>
        Filtered: {periodLabel}{branch ? ` · ${branch}` : ''}
      </span>
    </div>
  );
}

// ── BranchMonthlyChart ─────────────────────────────────────────────────────

function BranchMonthlyChart({ branchFilter, dateFrom, dateTo }: { branchFilter: string; dateFrom: string; dateTo: string }) {
  const { data, loading } = useBranchMonthly({
    movement_type: MOVEMENT_TYPES.SALE,
    date_from:     dateFrom,
    date_to:       dateTo,
  });

  if (loading) return <Panel title="Revenue Trend by Branch" sub="Monthly sales revenue — one line per branch"><Loader label="Loading…" /></Panel>;
  if (!data || data.monthly_data.length === 0) return <Panel title="Revenue Trend by Branch" sub="Monthly sales revenue — one line per branch"><Empty height={200} /></Panel>;

  // ✅ Filter branches client-side when a branch is selected
  const visibleBranches = branchFilter
    ? data.branches.filter(b => b.toLowerCase().includes(branchFilter.toLowerCase()))
    : data.branches;

  return (
    <Panel title="Revenue Trend by Branch" sub="Monthly sales revenue — one line per branch">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data.monthly_data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {visibleBranches.map((branch, i) => (
              <linearGradient key={branch} id={`kpi-gb-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BRANCH_COLORS[i % BRANCH_COLORS.length]} stopOpacity={0.22} />
                <stop offset="55%"  stopColor={BRANCH_COLORS[i % BRANCH_COLORS.length]} stopOpacity={0.06} />
                <stop offset="100%" stopColor={BRANCH_COLORS[i % BRANCH_COLORS.length]} stopOpacity={0}    />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={css.border} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} dy={6}
            tickFormatter={(v, i) => { const row = data.monthly_data[i]; return row ? `${v} ${row.year}` : String(v); }}
          />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickCount={5} width={36} />
          <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 3' }} />
          <Legend wrapperStyle={legendStyle} iconType="plainline" iconSize={18} />
          {visibleBranches.map((branch, i) => (
            <Area
              key={branch}
              type="natural"
              dataKey={branch}
              stroke={BRANCH_COLORS[i % BRANCH_COLORS.length]}
              strokeWidth={2}
              fill={`url(#kpi-gb-${i})`}
              dot={false}
              activeDot={{ r: 5, fill: css.card, stroke: BRANCH_COLORS[i % BRANCH_COLORS.length], strokeWidth: 2 }}
              name={branch}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// ── KPIEnginePage ──────────────────────────────────────────────────────────

export function KPIEnginePage() {
  const [period,       setPeriod]       = useState<PeriodKey>('ytd');
  const [branchFilter, setBranchFilter] = useState('');

  const { dateFrom, dateTo } = useMemo(() => periodToDates(period), [period]);

  // ── ALL hooks receive dateFrom / dateTo so they re-fetch on period change ──

  // Summary: monthly sales & purchases — filtered by period
  const { data: summaryRes, loading: summaryLoading, refetch: refetchSummary } = useTransactionSummary({
    date_from: dateFrom,
    date_to:   dateTo,
  });

  // Branch breakdowns — filtered by period
  const { data: branchSalesRes,     refetch: refetchBranchSales }     = useBranchBreakdown({ movement_type: MOVEMENT_TYPES.SALE,     date_from: dateFrom, date_to: dateTo });
  const { data: branchPurchasesRes, refetch: refetchBranchPurchases } = useBranchBreakdown({ movement_type: MOVEMENT_TYPES.PURCHASE, date_from: dateFrom, date_to: dateTo });

  // Movement type breakdown — filtered by period
  const { data: typeBreakdownRes, refetch: refetchTypeBreakdown } = useTypeBreakdown({ date_from: dateFrom, date_to: dateTo });

  // Stock and receivables — not time-filtered (snapshot-based)
  const { data: inventoryRes } = useInventorySnapshots({ page_size: 1 });
  const { data: agingRes }     = useAgingList({ page_size: 1 });

  const stockValue       = Number(inventoryRes?.items?.[0]?.total_lines_value ?? 0);
  const totalReceivables = agingRes?.grand_total ?? 0;

  const refetchAll = () => {
    refetchSummary();
    refetchBranchSales();
    refetchBranchPurchases();
    refetchTypeBreakdown();
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const monthlySummary: MonthlySummaryItem[] = summaryRes?.summary ?? [];

  // ✅ Monthly sales chart — already filtered by period via useTransactionSummary
  const monthlySalesData = [...monthlySummary]
    .sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month))
    .map(m => ({ month: `${m.month_label} ${m.year}`, sales: m.total_sales, purchases: m.total_purchases }));

  const branchSales     = branchSalesRes?.branches     ?? [];
  const branchPurchases = branchPurchasesRes?.branches ?? [];

  // ✅ All branches from current period data
  const allBranches = useMemo(() =>
    Array.from(new Set([...branchSales.map(b => b.branch), ...branchPurchases.map(b => b.branch)])).sort(),
    [branchSales, branchPurchases],
  );

  // ✅ Branch performance — filtered by selected branch AND period
  const branchPerformanceData = useMemo(() =>
    allBranches
      .filter(b => !branchFilter || b === branchFilter)
      .map(branch => ({
        branch,
        sales:     branchSales.find(b => b.branch === branch)?.total     ?? 0,
        purchases: branchPurchases.find(b => b.branch === branch)?.total ?? 0,
      })),
    [allBranches, branchFilter, branchSales, branchPurchases],
  );

  // ✅ Type breakdown — filtered by period, then optionally by branch client-side
  const typeData = useMemo(() =>
    (typeBreakdownRes?.breakdown ?? []).map(t => ({
      name: t.movement_type, in: t.total_in, out: t.total_out, count: t.count,
    })),
    [typeBreakdownRes],
  );

  // ✅ KPI aggregates derived from filtered period data (replaces useKPIs)
  const totalSales = useMemo(
    () => monthlySummary.reduce((s, m) => s + m.total_sales, 0),
    [monthlySummary],
  );

  const totalPurchases = useMemo(() => {
    // Prefer the branch breakdown total (more accurate for filtered period)
    const fromBranch = branchPurchasesRes?.branches.reduce((s, b) => s + b.total, 0);
    if (fromBranch !== undefined && fromBranch > 0) return fromBranch;
    return monthlySummary.reduce((s, m) => s + m.total_purchases, 0);
  }, [branchPurchasesRes, monthlySummary]);

  const totalPurchasesCount = useMemo(
    () => (typeBreakdownRes?.breakdown ?? []).find(t => t.movement_type === MOVEMENT_TYPES.PURCHASE)?.count ?? 0,
    [typeBreakdownRes],
  );

  const grossMargin = totalSales > 0 ? ((totalSales - totalPurchases) / totalSales) * 100 : 0;

  // Trend: compare first vs last month in current period
  const lastTwo    = monthlySummary.slice(-2);
  const salesTrend = lastTwo.length === 2 && lastTwo[0].total_sales > 0
    ? { value: Math.abs(((lastTwo[1].total_sales - lastTwo[0].total_sales) / lastTwo[0].total_sales) * 100), isPositive: lastTwo[1].total_sales >= lastTwo[0].total_sales }
    : undefined;

  const isLoading = summaryLoading;

  return (
    <div style={{ background: css.bg, minHeight: '100vh', padding: '32px 28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: css.fg, letterSpacing: '-0.03em', margin: 0 }}>KPI Engine</h1>
          <p style={{ fontSize: 13, color: css.mutedFg, marginTop: 4 }}>
            Automated calculation and monitoring of key performance indicators
          </p>
        </div>
        <button
          onClick={refetchAll}
          disabled={isLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px',
            borderRadius: 10, border: `1px solid ${css.border}`, background: css.card,
            color: css.cardFg, fontSize: 13, cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* ── Filters ── */}
      <div style={{ marginBottom: 24 }}>
        <FilterBar
          period={period}
          onPeriodChange={setPeriod}
          branch={branchFilter}
          onBranchChange={setBranchFilter}
          branches={allBranches}
        />
      </div>

      {/* ── Active filter badge ── */}
      <ActiveFilterBadge period={period} branch={branchFilter} />

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12, color: css.mutedFg }}>
          <Loader2 size={20} className="animate-spin" style={{ color: C.indigo }} />
          <span style={{ fontSize: 14 }}>Loading KPIs…</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* ── Business Overview KPIs — ✅ all derived from filtered data ── */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Business Overview" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <KPI
                title="Total Sales"
                value={formatCurrency(totalSales)}
                icon={TrendingUp}
                accent={C.indigo}
                trend={salesTrend}
              />
              <KPI
                title="Total Purchases"
                value={formatCurrency(totalPurchases)}
                icon={DollarSign}
                accent={C.amber}
                sub={`${formatNumber(totalPurchasesCount)} operations`}
              />
              <KPI
                title="Stock Value"
                value={formatCurrency(stockValue)}
                icon={Package}
                accent={C.cyan}
                sub="Latest snapshot"
              />
              <KPI
                title="Total Receivables"
                value={formatCurrency(totalReceivables)}
                icon={BarChart3}
                accent={C.violet}
                sub="Latest aging report"
              />
              <KPI
                title="Gross Margin"
                value={`${grossMargin.toFixed(1)}%`}
                icon={BarChart3}
                accent={C.teal}
                trend={{ value: 0, isPositive: grossMargin > 0 }}
              />
              {/* Sales / Stock Ratio */}
              <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden', borderTop: `3px solid ${C.emerald}`, paddingTop: 20 }}>
                <div style={{ position: 'absolute', bottom: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: C.emerald, opacity: 0.06, pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `${C.emerald}15`, border: `1px solid ${C.emerald}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Info size={16} style={{ color: C.emerald }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: C.emerald, background: `${C.emerald}12`, border: `1px solid ${C.emerald}25`, padding: '3px 8px', borderRadius: 20 }}>
                    <ArrowUpRight size={10} />ratio
                  </div>
                </div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>Sales / Stock Ratio</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: css.cardFg, marginTop: 5, marginBottom: 4, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {stockValue > 0 ? `${(totalSales / stockValue).toFixed(2)}x` : '—'}
                </p>
                <p style={{ fontSize: 11, color: css.mutedFg, marginBottom: 14 }}>Sales-to-inventory coverage</p>
                <div style={{ height: 3, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: '64%', background: `linear-gradient(90deg, ${C.emerald}60, ${C.emerald})` }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Sales vs Purchases Monthly — ✅ filtered by period ── */}
          <div style={{ marginBottom: 16 }}>
            <Panel title="Sales vs Purchases — Monthly Trend" sub={`${PERIOD_OPTIONS.find(o => o.key === period)?.label ?? period}${branchFilter ? ` · ${branchFilter}` : ''}`}>
              {summaryLoading ? <Loader label="Loading…" /> :
               monthlySalesData.length === 0 ? <Empty height={320} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlySalesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kpiGS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={C.indigo} stopOpacity={0.28} />
                        <stop offset="55%"  stopColor={C.indigo} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={C.indigo} stopOpacity={0}    />
                      </linearGradient>
                      <linearGradient id="kpiGP" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={C.amber} stopOpacity={0.28} />
                        <stop offset="55%"  stopColor={C.amber} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={C.amber} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={css.border} strokeWidth={1} vertical={false} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} dy={6} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickCount={5} width={36} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 3' }} />
                    <Legend wrapperStyle={legendStyle} iconType="plainline" iconSize={18} />
                    <Area type="natural" dataKey="sales"     stroke={C.indigo} strokeWidth={2.5} fill="url(#kpiGS)" name="Sales"     dot={false} activeDot={{ r: 5, fill: css.card, stroke: C.indigo, strokeWidth: 2.5 }} />
                    <Area type="natural" dataKey="purchases" stroke={C.amber}  strokeWidth={2.5} fill="url(#kpiGP)" name="Purchases" dot={false} activeDot={{ r: 5, fill: css.card, stroke: C.amber,  strokeWidth: 2.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          {/* ── Branch Performance — ✅ filtered by period + branch ── */}
          {branchPerformanceData.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Panel title="Branch Performance" sub={`Sales and purchases by branch · ${PERIOD_OPTIONS.find(o => o.key === period)?.label ?? period}`}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={branchPerformanceData} barCategoryGap="30%" barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kpiBSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={C.indigo} stopOpacity={1}    />
                        <stop offset="100%" stopColor={C.indigo} stopOpacity={0.55} />
                      </linearGradient>
                      <linearGradient id="kpiBPurch" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={C.amber} stopOpacity={1}    />
                        <stop offset="100%" stopColor={C.amber} stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={css.border} strokeWidth={1} vertical={false} />
                    <XAxis dataKey="branch" tick={axisStyle} axisLine={false} tickLine={false} dy={4} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickCount={5} width={36} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Legend wrapperStyle={legendStyle} iconType="plainline" iconSize={18} />
                    <Bar dataKey="sales"     fill="url(#kpiBSales)" name="Sales"     radius={[5, 5, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="purchases" fill="url(#kpiBPurch)" name="Purchases" radius={[5, 5, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          )}

          {/* ── Per-Branch Monthly Chart — ✅ filtered by period + branch ── */}
          <div style={{ marginBottom: 16 }}>
            <BranchMonthlyChart branchFilter={branchFilter} dateFrom={dateFrom} dateTo={dateTo} />
          </div>

          {/* ── Movement Type Breakdown — ✅ filtered by period ── */}
          {typeData.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Panel title="Movement Type Breakdown" sub="Inventory movement activity by type">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {typeData.map((t, i) => {
                    const maxVal = Math.max(...typeData.map(x => Math.max(x.in, x.out)), 1);
                    const pct    = ((t.in + t.out) / (maxVal * 2)) * 100;
                    const accent = BRANCH_COLORS[i % BRANCH_COLORS.length];
                    return (
                      <div key={i} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${css.border}`, background: css.bg }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: css.cardFg, margin: 0 }}>{t.name}</p>
                            <p style={{ fontSize: 11, color: css.mutedFg, margin: 0 }}>{formatNumber(t.count)} operations</p>
                          </div>
                          <div style={{ display: 'flex', gap: 20 }}>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: css.mutedFg, margin: 0 }}>In</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: C.emerald, margin: 0 }}>{formatCurrency(t.in)}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: css.mutedFg, margin: 0 }}>Out</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: C.rose, margin: 0 }}>{formatCurrency(t.out)}</p>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 5, borderRadius: 999, background: css.muted, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
                          <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: `linear-gradient(90deg, ${accent}65, ${accent})`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          )}

          {/* ── Sales KPIs ── */}
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${css.border}` }}>
            <SalesKPISection />
          </div>

          {/* ── Stock KPIs ── */}
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${css.border}` }}>
            <StockKPISection />
          </div>

          {/* ── Credit KPIs ── */}
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${css.border}` }}>
            <CreditKPISection />
          </div>
        </>
      )}
    </div>
  );
}