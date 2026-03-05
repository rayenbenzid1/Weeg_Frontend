// src/app/pages/KPIEnginePage.tsx
import { useState, useMemo , useRef, useEffect} from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  TrendingUp, Package, DollarSign, BarChart3,
  Info, RefreshCw, Loader2, ChevronDown, ArrowUpRight,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { Progress } from '../components/ui/progress';
import { CreditKPISection } from '../components/CreditKPISection';
import { SalesKPISection } from '../components/SalesKPISection';
import { StockKPISection } from '../components/StockKPISection';
import {
  MOVEMENT_TYPES,
  useKPIs,
  useTransactionSummary,
  useBranchBreakdown,
  useTypeBreakdown,
  useAgingRisk,
  useBranchMonthly,
  type MonthlySummaryItem,
} from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

// ── Brand palette (chart colors only) ─────────────────────────────────────

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
  popover:   'hsl(var(--popover))',
  popoverFg: 'hsl(var(--popover-foreground))',
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
      background:   css.popover,
      border:       `1px solid ${css.border}`,
      borderRadius: 10,
      padding:      '10px 14px',
      boxShadow:    '0 8px 24px rgba(0,0,0,0.15)',
      fontSize:     12,
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: css.mutedFg }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', paddingLeft: 16, fontWeight: 700, color: css.popoverFg }}>
            {typeof p.value === 'number' ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
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
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
      {/* soft glow */}
      <div style={{
        position: 'absolute', top: -24, right: -24, width: 80, height: 80,
        borderRadius: '50%', background: accent, opacity: 0.08,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
        <ArrowUpRight size={13} style={{ color: trend?.isPositive === false ? C.rose : C.emerald }} />
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg }}>
        {title}
      </p>
      <p style={{ fontSize: 20, fontWeight: 800, color: css.cardFg, marginTop: 4, letterSpacing: '-0.03em' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>{sub}</p>}
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

// ── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 800, color: css.fg, letterSpacing: '-0.02em', margin: '0 0 16px 0' }}>
      {title}
    </h2>
  );
}

// ── FilterBar ──────────────────────────────────────────────────────────────

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

// ── StyledDropdown (controlled) ────────────────────────────────────────────

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
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const current = options.find(o => o.key === value)?.label ?? label;

  // Calcule la position du menu au moment de l'ouverture
  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top:   rect.bottom + window.scrollY + 6,
        left:  rect.left   + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

const menu = isOpen ? createPortal(
  <div
    style={{
      position:     'absolute',
      top:          menuPos.top,
      left:         menuPos.left,
      width:        menuPos.width,
      zIndex:       9999,
      background:   '#ffffff',          // ← blanc pur hardcodé
      border:       '1px solid #e5e7eb',
      borderRadius: 12,
      boxShadow:    '0 8px 32px rgba(0,0,0,0.18)',
      maxHeight:    280,
      overflowY:    'auto',
      padding:      6,
    }}
  >
    {options.map(opt => (
      <button
        key={opt.key}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => { onChange(opt.key); onClose(); }}
        style={{
          width: '100%', textAlign: 'left', padding: '8px 12px',
          borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
          background: value === opt.key ? `${C.indigo}15` : 'transparent',
          color:      value === opt.key ? C.indigo : '#111827',  // ← hardcodé
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
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0, marginLeft: 8, color: css.mutedFg,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
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
    <Panel title="Filters" sub="Customize your transaction view">
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              whiteSpace: 'nowrap',
            }}
          >
            Reset filters
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ── Movement type translation ──────────────────────────────────────────────

const MOVEMENT_TYPE_EN: Record<string, string> = {
  'ف بيع': 'Sale', 'مردودات بيع': 'Sales Return',
  'ف شراء': 'Purchase', 'مردود شراء': 'Purchase Return',
  'نقل': 'Transfer', 'ف تحويل': 'Transfer',
  'اخراج رئيسي': 'Main Exit', 'ف اخراج رئيسي': 'Main Exit',
  'ف.أول المدة': 'Opening Balance', 'أول المدة': 'Opening Balance', 'ف أول المدة': 'Opening Balance',
  'ف تسوية المخ': 'Inventory Adjustment', 'ف تسوية': 'Adjustment',
  'ف.تالف': 'Damaged Goods', 'ف تالف': 'Damaged Goods', 'تالف': 'Damaged Goods',
  'ف.عينات': 'Samples', 'ف عينات': 'Samples', 'عينات': 'Samples',
  'ادخال رئيسي': 'Main Entry', 'ف ادخال رئيسي': 'Main Entry',
};
function toEnLabel(arabicType: string): string {
  if (MOVEMENT_TYPE_EN[arabicType]) return MOVEMENT_TYPE_EN[arabicType];
  const trimmed = arabicType.trim();
  for (const [key, val] of Object.entries(MOVEMENT_TYPE_EN)) {
    if (trimmed.includes(key) || key.includes(trimmed)) return val;
  }
  return arabicType;
}

// ── BranchMonthlyChart ─────────────────────────────────────────────────────

function BranchMonthlyChart({ branchFilter, dateFrom, dateTo }: { branchFilter: string; dateFrom: string; dateTo: string }) {
  const { data, loading } = useBranchMonthly({
    movement_type: MOVEMENT_TYPES.SALE,
    date_from: dateFrom,
    date_to:   dateTo,
  });

  if (loading) {
    return (
      <Panel title="Monthly Sales by Branch" sub="Revenue trend — one line per branch">
        <Loader label="Loading…" />
      </Panel>
    );
  }
  if (!data || data.monthly_data.length === 0) {
    return (
      <Panel title="Monthly Sales by Branch" sub="Revenue trend — one line per branch">
        <Empty height={200} />
      </Panel>
    );
  }

  const visibleBranches = branchFilter
    ? data.branches.filter(b => b.toLowerCase().includes(branchFilter.toLowerCase()))
    : data.branches;

  return (
    <Panel title="Monthly Sales by Branch" sub="Revenue trend — one line per branch">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.monthly_data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={css.border} vertical={false} />
          <XAxis
            dataKey="month"
            tick={axisStyle} axisLine={false} tickLine={false}
            tickFormatter={(v, i) => {
              const row = data.monthly_data[i];
              return row ? `${v} ${row.year}` : String(v);
            }}
          />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <RechartsTooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
          {visibleBranches.map((branch, i) => (
            <Line
              key={branch}
              type="monotone"
              dataKey={branch}
              stroke={BRANCH_COLORS[i % BRANCH_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
              name={branch}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// ── KPIEnginePage ──────────────────────────────────────────────────────────

export function KPIEnginePage() {
  const [period,       setPeriod]       = useState<PeriodKey>('ytd');
  const [branchFilter, setBranchFilter] = useState('');

  const { dateFrom, dateTo } = useMemo(() => periodToDates(period), [period]);

  const { data: kpis, loading: kpiLoading, refetch: refetchKPIs } = useKPIs();

  const { data: summaryRes, loading: summaryLoading } = useTransactionSummary({ date_from: dateFrom, date_to: dateTo });

  const { data: branchSalesRes } = useBranchBreakdown({ movement_type: MOVEMENT_TYPES.SALE,     date_from: dateFrom, date_to: dateTo });
  const { data: branchPurchasesRes } = useBranchBreakdown({ movement_type: MOVEMENT_TYPES.PURCHASE, date_from: dateFrom, date_to: dateTo });
  const { data: typeBreakdownRes } = useTypeBreakdown({ date_from: dateFrom, date_to: dateTo });
  const { data: _agingRiskRes } = useAgingRisk({ limit: 5 });

  const monthlySummary: MonthlySummaryItem[] = summaryRes?.summary ?? [];

  const monthlySalesData = [...monthlySummary]
    .sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month))
    .slice(-12)
    .map(m => ({ month: `${m.month_label} ${m.year}`, sales: m.total_sales, purchases: m.total_purchases }));

  const branchSales     = branchSalesRes?.branches     ?? [];
  const branchPurchases = branchPurchasesRes?.branches ?? [];

  const allBranches = useMemo(() =>
    Array.from(new Set([...branchSales.map(b => b.branch), ...branchPurchases.map(b => b.branch)])).sort(),
    [branchSales, branchPurchases],
  );

  const branchPerformanceData = useMemo(() =>
    allBranches
      .filter(b => !branchFilter || b === branchFilter)
      .map((branch, i) => ({
        branch,
        sales:     branchSales.find(b => b.branch === branch)?.total     ?? 0,
        purchases: branchPurchases.find(b => b.branch === branch)?.total ?? 0,
      })),
    [allBranches, branchFilter, branchSales, branchPurchases],
  );

  const typeData = useMemo(() =>
    (typeBreakdownRes?.breakdown ?? []).map(t => ({
      name: toEnLabel(t.movement_type), in: t.total_in, out: t.total_out, count: t.count,
    })),
    [typeBreakdownRes],
  );

  const purchaseBreakdown = (typeBreakdownRes?.breakdown ?? []).find(t => t.movement_type === MOVEMENT_TYPES.PURCHASE);

  const totalSales          = kpis?.totalSalesValue    ?? 0;
  const totalPurchases      = purchaseBreakdown?.total_in ?? kpis?.totalPurchasesValue ?? 0;
  const totalPurchasesCount = purchaseBreakdown?.count    ?? 0;
  const stockValue          = kpis?.stockValue          ?? 0;
  const totalReceivables    = kpis?.totalReceivables     ?? 0;
  const grossMargin         = totalSales > 0 ? ((totalSales - totalPurchases) / totalSales) * 100 : 0;

  const lastTwo    = monthlySummary.slice(-2);
  const salesTrend = lastTwo.length === 2 && lastTwo[0].total_sales > 0
    ? { value: Math.abs(((lastTwo[1].total_sales - lastTwo[0].total_sales) / lastTwo[0].total_sales) * 100), isPositive: lastTwo[1].total_sales >= lastTwo[0].total_sales }
    : undefined;

  return (
    <div style={{ background: css.bg, minHeight: '100vh', padding: '32px 28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: css.fg, letterSpacing: '-0.03em', margin: 0 }}>
            KPI Engine
          </h1>
          <p style={{ fontSize: 13, color: css.mutedFg, marginTop: 4 }}>
            Automated calculation and monitoring of key performance indicators
          </p>
        </div>
        <button
          onClick={refetchKPIs}
          disabled={kpiLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 16px', borderRadius: 10,
            border: `1px solid ${css.border}`, background: css.card,
            color: css.cardFg, fontSize: 13, cursor: kpiLoading ? 'not-allowed' : 'pointer',
            opacity: kpiLoading ? 0.6 : 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {kpiLoading
            ? <Loader2 size={14} className="animate-spin" />
            : <RefreshCw size={14} />}
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

      {/* ── Loading state ── */}
      {kpiLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12, color: css.mutedFg }}>
          <Loader2 size={20} className="animate-spin" style={{ color: C.indigo }} />
          <span style={{ fontSize: 14 }}>Loading KPIs…</span>
        </div>
      )}

      {!kpiLoading && (
        <>
          {/* ── Business Overview KPIs ── */}
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
              />
              <KPI
                title="Total Receivables"
                value={formatCurrency(totalReceivables)}
                icon={BarChart3}
                accent={C.violet}
              />
              <KPI
                title="Gross Margin"
                value={`${grossMargin.toFixed(1)}%`}
                icon={BarChart3}
                accent={C.teal}
                trend={{ value: 0, isPositive: grossMargin > 0 }}
              />
              {/* Sales / Stock Ratio card */}
              <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: -24, right: -24, width: 80, height: 80,
                  borderRadius: '50%', background: C.emerald, opacity: 0.08,
                  filter: 'blur(20px)', pointerEvents: 'none',
                }} />
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: `${C.emerald}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Info size={17} style={{ color: C.emerald }} />
                  </div>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg }}>
                  Sales / Stock Ratio
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: css.cardFg, marginTop: 4, letterSpacing: '-0.03em' }}>
                  {stockValue > 0 ? `${(totalSales / stockValue).toFixed(2)}x` : '—'}
                </p>
                <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>Sales-to-inventory coverage</p>
              </div>
            </div>
          </div>

          {/* ── Sales vs Purchases Monthly ── */}
          <div style={{ marginBottom: 16 }}>
            <Panel title="Sales vs Purchases — Monthly Trend" sub="Last 12 months comparison">
              {summaryLoading ? <Loader label="Loading…" /> :
               monthlySalesData.length === 0 ? <Empty height={320} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlySalesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kpiGS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.indigo} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.indigo} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="kpiGP" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.amber} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke={css.border} vertical={false} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                    <Area type="monotone" dataKey="sales"     stroke={C.indigo} strokeWidth={2.5} fill="url(#kpiGS)" name="Sales"     dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="purchases" stroke={C.amber}  strokeWidth={2.5} fill="url(#kpiGP)" name="Purchases" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          {/* ── Branch Performance ── */}
          {branchPerformanceData.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Panel title="Branch Performance" sub="Sales and purchases by branch">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={branchPerformanceData} barCategoryGap="36%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={css.border} vertical={false} />
                    <XAxis dataKey="branch" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                    <Bar dataKey="sales"     fill={C.indigo} name="Sales"     radius={[5, 5, 0, 0]} />
                    <Bar dataKey="purchases" fill={C.amber}  name="Purchases" radius={[5, 5, 0, 0]} fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          )}

          {/* ── Per-Branch Monthly Line Chart ── */}
          <div style={{ marginBottom: 16 }}>
            <BranchMonthlyChart branchFilter={branchFilter} dateFrom={dateFrom} dateTo={dateTo} />
          </div>

          {/* ── Movement Type Breakdown ── */}
          {typeData.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Panel title="Movement Type Breakdown" sub="Inventory movement activity by type">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {typeData.map((t, i) => {
                    const maxVal = Math.max(...typeData.map(x => Math.max(x.in, x.out)), 1);
                    const pct    = ((t.in + t.out) / (maxVal * 2)) * 100;
                    const accent = BRANCH_COLORS[i % BRANCH_COLORS.length];
                    return (
                      <div key={i} style={{
                        padding: '14px 16px', borderRadius: 12,
                        border: `1px solid ${css.border}`,
                        background: css.bg,
                        transition: 'background 0.15s',
                      }}>
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
                        <div style={{ height: 5, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 999, width: `${pct}%`,
                            background: `linear-gradient(90deg, ${accent}55, ${accent})`,
                            transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                          }} />
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