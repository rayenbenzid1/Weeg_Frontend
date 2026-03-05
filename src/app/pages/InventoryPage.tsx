import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, AlertTriangle, TrendingUp, RefreshCw, Loader2, ChevronDown, ArrowUpRight } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import {
  useInventory,
  useInventoryDates,
  useBranchSummary,
  useCategoryBreakdown,
  type InventoryItem,
} from '../lib/dataHooks';
import { formatCurrency, formatNumber, toNum } from '../lib/utils';

// ── Branch columns ────────────────────────────────────────────────────────────
const BRANCH_KEYS: { key: keyof InventoryItem; label: string }[] = [
  { key: 'qty_alkarimia', label: 'Al-Karimia' },
  { key: 'qty_benghazi',  label: 'Benghazi'   },
  { key: 'qty_mazraa',    label: 'Mazraa'     },
  { key: 'qty_dahmani',   label: 'Dahmani'    },
  { key: 'qty_janzour',   label: 'Janzour'    },
  { key: 'qty_misrata',   label: 'Misrata'    },
];

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

const BRANCH_COLORS   = [C.indigo, C.cyan, C.emerald, C.amber, C.rose, C.violet];
const CATEGORY_COLORS = [C.indigo, C.cyan, C.emerald, C.amber, C.rose, C.violet, C.orange, C.teal];

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e5e7eb',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontSize: 12,
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill ?? p.color, display: 'inline-block' }} />
          <span style={{ color: '#6b7280' }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', paddingLeft: 16, fontWeight: 700, color: '#111827' }}>
            {typeof p.value === 'number' && p.name?.toLowerCase().includes('value')
              ? formatCurrency(p.value)
              : formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Custom Pie Tooltip ────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e5e7eb',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.payload.fill }} />
        <span style={{ fontWeight: 700, color: '#111827' }}>{p.name}</span>
      </div>
      <p style={{ color: '#6b7280', margin: 0 }}>
        Value: <span style={{ fontWeight: 700, color: '#111827' }}>{formatCurrency(p.value)}</span>
      </p>
      {p.payload.qty != null && (
        <p style={{ color: '#6b7280', margin: '2px 0 0' }}>
          Qty: <span style={{ fontWeight: 700, color: '#111827' }}>{formatNumber(p.payload.qty)}</span>
        </p>
      )}
    </div>
  );
}

// ── StyledDropdown — portal-based ─────────────────────────────────────────────
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
      setMenuPos({
        top:   rect.bottom + window.scrollY + 6,
        left:  rect.left   + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  const menu = isOpen ? createPortal(
    <div style={{
      position:     'absolute',
      top:          menuPos.top,
      left:         menuPos.left,
      width:        menuPos.width,
      zIndex:       9999,
      background:   '#ffffff',
      border:       '1px solid #e5e7eb',
      borderRadius: 12,
      boxShadow:    '0 8px 32px rgba(0,0,0,0.18)',
      maxHeight:    280,
      overflowY:    'auto',
      padding:      6,
    }}>
      {options.map(opt => (
        <button
          key={opt.key}
          onMouseDown={e => e.stopPropagation()}
          onClick={() => { onChange(opt.key); onClose(); }}
          style={{
            width:          '100%',
            textAlign:      'left',
            padding:        '8px 12px',
            borderRadius:   8,
            border:         'none',
            cursor:         'pointer',
            fontSize:       13,
            background:     value === opt.key ? `${C.indigo}15` : 'transparent',
            color:          value === opt.key ? C.indigo : '#111827',
            fontWeight:     value === opt.key ? 600 : 400,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
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
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <p style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: css.mutedFg, marginBottom: 6,
      }}>
        {label}
      </p>
      <button
        ref={btnRef}
        onClick={onToggle}
        style={{
          width:          '100%',
          height:         38,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0 12px',
          borderRadius:   10,
          border:         `1px solid ${css.border}`,
          background:     css.card,
          color:          css.cardFg,
          fontSize:       13,
          cursor:         'pointer',
          boxShadow:      '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current}
        </span>
        <ChevronDown size={14} style={{
          flexShrink:  0,
          marginLeft:  8,
          color:       css.mutedFg,
          transform:   isOpen ? 'rotate(180deg)' : 'none',
          transition:  'transform 0.2s',
        }} />
      </button>
      {menu}
    </div>
  );
}

// ── Stock Status Badge ────────────────────────────────────────────────────────
function StockStatusBadge({ qty }: { qty: number }) {
  const [accent, label] =
    qty === 0 ? [C.rose,    'Out of Stock'] :
    qty < 5   ? [C.rose,    '🔴 Critical'  ] :
    qty < 20  ? [C.amber,   '🟡 Low'       ] :
                [C.emerald, '🟢 Normal'    ];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: `${accent}18`, color: accent, border: `1px solid ${accent}35`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
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

// ── Page ──────────────────────────────────────────────────────────────────────
export function InventoryPage() {
  const [selectedDate,     setSelectedDate]     = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openDropdown,     setOpenDropdown]     = useState<'date' | 'category' | null>(null);

  const { data: datesData }    = useInventoryDates();
  const dates                  = datesData?.dates ?? [];
  const latestDate             = selectedDate || dates[0] || undefined;

  const { data: inventoryData, loading: invLoading, error: invError, refetch } = useInventory({
    snapshot_date: latestDate,
    category:      selectedCategory !== 'all' ? selectedCategory : undefined,
    page_size:     200,
  });

  const { data: branchData,   loading: branchLoading } = useBranchSummary({ snapshot_date: latestDate });
  const { data: categoryData }                          = useCategoryBreakdown({ snapshot_date: latestDate });

  const items      = inventoryData?.items ?? [];
  const totals     = inventoryData?.totals;
  const branches   = branchData?.branches ?? [];
  const categories = categoryData?.categories ?? [];

  const totalQty   = toNum(totals?.grand_total_qty);
  const totalValue = toNum(totals?.grand_total_value);

  const lowStockItems   = items.filter(item => toNum(item.total_qty) < 5 && toNum(item.total_qty) > 0);
  const outOfStockItems = items.filter(item => toNum(item.total_qty) === 0);

  const categoryPieData = categories.slice(0, 8).map((c, i) => ({
    name:  c.category || 'Uncategorized',
    value: toNum(c.total_value),
    qty:   toNum(c.total_qty),
    fill:  CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const branchBarData = branches.map((b, i) => ({
    name:  b.branch,
    qty:   toNum(b.total_qty),
    value: toNum(b.total_value),
    fill:  BRANCH_COLORS[i % BRANCH_COLORS.length],
  }));

  // Dropdown options
  const dateOptions = dates.map(d => ({ key: d, label: d }));
  const categoryOptions = [
    { key: 'all', label: 'All Categories' },
    ...categories.map(c => ({ key: c.category, label: c.category })),
  ];

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'product_code',
      label: 'Code',
      render: (row: InventoryItem) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: css.mutedFg }}>{row.product_code}</span>
      ),
    },
    {
      key: 'product_name',
      label: 'Product',
      render: (row: InventoryItem) => (
        <div>
          <p style={{ fontWeight: 600, fontSize: 13, margin: 0, color: css.cardFg }}>{row.product_name}</p>
          {row.category && <p style={{ fontSize: 11, color: css.mutedFg, margin: 0 }}>{row.category}</p>}
        </div>
      ),
    },
    {
      key: 'total_qty',
      label: 'Total Qty',
      render: (row: InventoryItem) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: css.cardFg }}>{formatNumber(toNum(row.total_qty))}</span>
      ),
    },
    {
      key: 'total_value',
      label: 'Total Value',
      render: (row: InventoryItem) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: C.indigo }}>{formatCurrency(toNum(row.total_value))}</span>
      ),
    },
    {
      key: 'cost_price',
      label: 'Cost Price',
      render: (row: InventoryItem) => (
        <span style={{ fontSize: 13, color: css.cardFg }}>{formatCurrency(toNum(row.cost_price))}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: InventoryItem) => <StockStatusBadge qty={toNum(row.total_qty)} />,
    },
    ...BRANCH_KEYS.map(b => ({
      key: b.key as string,
      label: b.label,
      render: (row: InventoryItem) => {
        const val = toNum(row[b.key]);
        return (
          <span style={{ fontSize: 13, fontWeight: val === 0 ? 400 : 600, color: val === 0 ? css.mutedFg : css.cardFg }}>
            {val === 0 ? '—' : formatNumber(val)}
          </span>
        );
      },
    })),
  ];

  return (
    <div style={{ background: css.bg, minHeight: '100vh', padding: '32px 28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: css.fg, letterSpacing: '-0.03em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: `${C.indigo}18`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} style={{ color: C.indigo }} />
            </span>
            Multi-Branch Inventory
          </h1>
          <p style={{ fontSize: 13, color: css.mutedFg, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            Monitor and manage inventory across all branches
            {latestDate && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${C.indigo}18`, color: C.indigo, border: `1px solid ${C.indigo}35` }}>
                Snapshot: {latestDate}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={invLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'transparent', border: `1px solid ${css.border}`,
            color: css.mutedFg, cursor: invLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {invLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* ── Filters ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Filters</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>Filter inventory data by date snapshot and category</p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StyledDropdown
            label="Snapshot Date"
            options={dateOptions}
            value={selectedDate || (dates[0] ?? '')}
            onChange={setSelectedDate}
            isOpen={openDropdown === 'date'}
            onToggle={() => setOpenDropdown(o => o === 'date' ? null : 'date')}
            onClose={() => setOpenDropdown(null)}
          />
          <StyledDropdown
            label="Category"
            options={categoryOptions}
            value={selectedCategory}
            onChange={setSelectedCategory}
            isOpen={openDropdown === 'category'}
            onToggle={() => setOpenDropdown(o => o === 'category' ? null : 'category')}
            onClose={() => setOpenDropdown(null)}
          />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Total Stock Value', value: invLoading ? '…' : formatCurrency(totalValue),                      sub: `Across ${branches.length} branches`,               accent: C.indigo,  icon: Package       },
          { label: 'Total SKUs',        value: invLoading ? '…' : formatNumber(inventoryData?.count ?? 0),          sub: 'Active product lines',                             accent: C.cyan,    icon: TrendingUp    },
          { label: 'Total Units',       value: invLoading ? '…' : formatNumber(totalQty),                          sub: 'Total quantity in stock',                          accent: C.emerald, icon: Package       },
          { label: 'Stock Alerts',      value: invLoading ? '…' : String(lowStockItems.length + outOfStockItems.length), sub: `${outOfStockItems.length} out of stock · ${lowStockItems.length} low`, accent: C.rose, icon: AlertTriangle },
        ].map((kpi, i) => (
          <div key={i} style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: kpi.accent, opacity: 0.08, filter: 'blur(20px)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${kpi.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.icon size={17} style={{ color: kpi.accent }} />
              </div>
              <ArrowUpRight size={13} style={{ color: C.emerald }} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>{kpi.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: i === 3 ? kpi.accent : css.cardFg, margin: '4px 0 0', letterSpacing: '-0.03em' }}>{kpi.value}</p>
            <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Branch Cards ── */}
      {!branchLoading && branches.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
          {branches.map((branch, i) => {
            const branchValue = toNum(branch.total_value);
            const branchQty   = toNum(branch.total_qty);
            const pct         = totalValue > 0 ? (branchValue / totalValue) * 100 : 0;
            const accent      = BRANCH_COLORS[i % BRANCH_COLORS.length];
            return (
              <div key={branch.branch} style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: accent, opacity: 0.07, filter: 'blur(18px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>{branch.branch}</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: `${accent}08`, border: `1px solid ${accent}20` }}>
                    <p style={{ fontSize: 10, color: css.mutedFg, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Stock Value</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: accent, margin: 0 }}>{formatCurrency(branchValue)}</p>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: css.muted }}>
                    <p style={{ fontSize: 10, color: css.mutedFg, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Qty</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: css.cardFg, margin: 0 }}>{formatNumber(branchQty)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: css.mutedFg, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>% of total stock</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: `linear-gradient(90deg, ${accent}70, ${accent})`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        <Panel title="Stock Value by Branch" sub="Distribution of inventory value across branches">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={branchBarData} barCategoryGap="36%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                {branchBarData.map((b, i) => (
                  <linearGradient key={i} id={`bg-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={b.fill} stopOpacity={1}   />
                    <stop offset="100%" stopColor={b.fill} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={css.border} vertical={false} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Stock Value" radius={[6, 6, 0, 0]}>
                {branchBarData.map((_, i) => (
                  <Cell key={i} fill={`url(#bg-${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Stock by Category" sub="Value breakdown by product category">
          {categoryPieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={200} height={220}>
                  <PieChart>
                    <defs>
                      {categoryPieData.map((c, i) => (
                        <radialGradient key={i} id={`cg-${i}`} cx="50%" cy="50%" r="50%">
                          <stop offset="0%"   stopColor={c.fill} stopOpacity={1}    />
                          <stop offset="100%" stopColor={c.fill} stopOpacity={0.75} />
                        </radialGradient>
                      ))}
                    </defs>
                    <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {categoryPieData.map((_, i) => (
                        <Cell key={i} fill={`url(#cg-${i})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                {categoryPieData.map((c, i) => {
                  const total = categoryPieData.reduce((s, d) => s + d.value, 0);
                  const share = total > 0 ? (c.value / total) * 100 : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.fill, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: css.mutedFg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: css.cardFg, flexShrink: 0, marginLeft: 8 }}>{share.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${share}%`, background: `linear-gradient(90deg, ${c.fill}70, ${c.fill})`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.mutedFg, fontSize: 13 }}>
              No category data available
            </div>
          )}
        </Panel>
      </div>

      {/* ── Inventory Table ── */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Inventory Details</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
            Complete inventory across all branches{latestDate ? ` — Snapshot: ${latestDate}` : ''}
          </p>
        </div>

        {invError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
            <AlertTriangle size={32} style={{ color: C.rose }} />
            <p style={{ color: C.rose, fontSize: 14, margin: 0 }}>{invError}</p>
            <button onClick={refetch} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', border: `1px solid ${css.border}`, color: css.mutedFg, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : invLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 10, color: css.mutedFg }}>
            <Loader2 size={22} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Loading inventory...</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10, color: css.mutedFg }}>
            <Package size={40} style={{ opacity: 0.25 }} />
            <p style={{ fontSize: 13, margin: 0 }}>No inventory data found for the selected filters.</p>
          </div>
        ) : (
          <DataTable data={items} columns={columns} searchable exportable pageSize={15} />
        )}
      </div>
    </div>
  );
}