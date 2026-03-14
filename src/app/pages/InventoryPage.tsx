// src/app/pages/InventoryPage.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, AlertTriangle, TrendingUp, RefreshCw, Loader2, ChevronDown, ArrowUpRight } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import {
  useInventorySnapshots,
  useInventoryLines,
  useBranchSummary,
  useCategoryBreakdown,
  type InventorySnapshotLine,
} from '../lib/dataHooks';
import { formatCurrency, formatNumber, toNum } from '../lib/utils';

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
const BRANCH_COLORS   = [C.indigo, C.cyan, C.emerald, C.amber, C.rose, C.violet];
const CATEGORY_COLORS = [C.indigo, C.cyan, C.emerald, C.amber, C.rose, C.violet, C.orange, C.teal];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: css.card, border: `1px solid ${css.border}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 12, minWidth: 220, maxWidth: 300 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: css.cardFg, paddingBottom: 8, borderBottom: `1px solid ${css.border}`, margin: '0 0 8px 0' }}>{label}</p>
      <div style={{ marginTop: 10 }}>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i > 0 ? 8 : 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.fill ?? p.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: css.mutedFg, flex: 1 }}>{p.name}</span>
            <span style={{ fontWeight: 700, color: css.cardFg }}>
              {typeof p.value === 'number' && p.name?.toLowerCase().includes('value') ? formatCurrency(p.value) : formatNumber(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: css.card, border: `1px solid ${css.border}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 12, minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: p.payload.fill, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: css.cardFg }}>{p.name}</span>
      </div>
      <p style={{ color: css.mutedFg, margin: 0 }}>Value: <span style={{ fontWeight: 700, color: css.cardFg }}>{formatCurrency(p.value)}</span></p>
      {p.payload.qty != null && <p style={{ color: css.mutedFg, margin: '4px 0 0' }}>Qty: <span style={{ fontWeight: 700, color: css.cardFg }}>{formatNumber(p.payload.qty)}</span></p>}
    </div>
  );
}

function StyledDropdown({ label, options, value, onChange, isOpen, onToggle, onClose }: {
  label: string; options: { key: string; label: string }[]; value: string;
  onChange: (v: string) => void; isOpen: boolean; onToggle: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const current = options.find(o => o.key === value)?.label ?? label;

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose]);

  const menu = isOpen ? createPortal(
    <div style={{ position: 'absolute', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 9999, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: 280, overflowY: 'auto', padding: 6 }}>
      {options.map(opt => (
        <button key={opt.key} onMouseDown={e => e.stopPropagation()} onClick={() => { onChange(opt.key); onClose(); }}
          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: value === opt.key ? `${C.indigo}15` : 'transparent', color: value === opt.key ? C.indigo : '#111827', fontWeight: value === opt.key ? 600 : 400, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {opt.label}
          {value === opt.key && <span style={{ color: C.indigo, fontSize: 12 }}>✓</span>}
        </button>
      ))}
    </div>, document.body,
  ) : null;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, marginBottom: 6 }}>{label}</p>
      <button ref={btnRef} onClick={onToggle} style={{ width: '100%', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderRadius: 10, border: `1px solid ${css.border}`, background: css.card, color: css.cardFg, fontSize: 13, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: 8, color: css.mutedFg, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {menu}
    </div>
  );
}

function StockStatusBadge({ quantity }: { quantity: number }) {
  const [accent, label] =
    quantity === 0  ? [C.rose,    'Out of Stock'] :
    quantity < 30   ? [C.rose,    '🔴 Critical'  ] :
    quantity <= 50  ? [C.amber,   '🟡 Low'       ] :
                      [C.emerald, '🟢 Normal'    ];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${accent}18`, color: accent, border: `1px solid ${accent}35`, whiteSpace: 'nowrap' }}>{label}</span>;
}

function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden', borderTop: `3px solid ${accent}`, paddingTop: 20 }}>
      <div style={{ position: 'absolute', bottom: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: accent, opacity: 0.06, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: `${accent}15`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: C.emerald, background: `${C.emerald}12`, border: `1px solid ${C.emerald}25`, padding: '3px 8px', borderRadius: 20 }}>
          <ArrowUpRight size={10} />live
        </div>
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: css.cardFg, marginTop: 5, marginBottom: 4, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: css.mutedFg, marginBottom: 14 }}>{sub}</p>}
      {!sub && <div style={{ marginBottom: 14 }} />}
      <div style={{ height: 3, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: '64%', background: `linear-gradient(90deg, ${accent}60, ${accent})` }} />
      </div>
    </div>
  );
}

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

export function InventoryPage() {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [selectedBranch,     setSelectedBranch]     = useState<string>('all');
  const [openDropdown,       setOpenDropdown]       = useState<'snapshot' | 'branch' | null>(null);
  const [tablePage,          setTablePage]          = useState(1);
  const [tableSearch,        setTableSearch]        = useState('');

  const { data: snapshotsData, loading: snapsLoading } = useInventorySnapshots({ page_size: 50 });
  const snapshots     = snapshotsData?.items ?? [];
  const currentSnapId = selectedSnapshotId || snapshots[0]?.id || '';
  const currentSnap   = snapshots.find(s => s.id === currentSnapId) ?? null;

  // branchParam: undefined = all, string = exact branch name
  const branchParam = selectedBranch !== 'all' ? selectedBranch : undefined;

  // ✅ Hook dédié pour les TOTAUX seulement (page_size=1, toujours page 1)
  // Les totaux (distinct_products, grand_total_qty, etc.) sont calculés
  // sur le queryset COMPLET filtré par branch, avant toute pagination.
  // En utilisant un hook séparé avec page_size=1, on s'assure que :
  // - distinct_products = nb de produits uniques dans la branch sélectionnée
  // - grand_total_qty   = quantité totale réelle (pas juste les 100 premières lignes)
  // - etc.
  const { data: totalsData, loading: totalsLoading } = useInventoryLines(currentSnapId || null, {
    page:      1,
    page_size: 1,
    branch:    branchParam,
    search:    tableSearch || undefined,
  });

  // Hook paginé pour le tableau des lignes
  const { data: linesData, loading: linesLoading, error: linesError, refetch } =
    useInventoryLines(currentSnapId || null, {
      page:      tablePage,
      page_size: 100,
      branch:    branchParam,
      search:    tableSearch || undefined,
    });

  // Branch summary sans filtre → dropdown
  const { data: allBranchData, loading: branchLoading } = useBranchSummary({ snapshot_id: currentSnapId });

  // Branch summary avec filtre → cards + bar chart
  const { data: filteredBranchData } = useBranchSummary({ snapshot_id: currentSnapId, branch: branchParam });

  // Category breakdown avec filtre
  const { data: categoryData } = useCategoryBreakdown({ snapshot_id: currentSnapId, branch: branchParam });

  const allBranches     = allBranchData?.branches    ?? [];
  const displayBranches = filteredBranchData?.branches ?? [];
  const categories      = categoryData?.categories   ?? [];
  const lines           = linesData?.lines           ?? [];

  // ✅ Tous les KPI viennent de totalsData (appel dédié, pas affecté par la pagination)
  const totalQty           = toNum(totalsData?.totals?.grand_total_qty);
  const totalValue         = toNum(totalsData?.totals?.grand_total_value);
  const uniqueProductCount = totalsData?.totals?.distinct_products  ?? 0;
  const outOfStockCount    = totalsData?.totals?.out_of_stock_count ?? 0;
  const criticalCount      = totalsData?.totals?.critical_count     ?? 0;
  const lowCount           = totalsData?.totals?.low_count          ?? 0;
  const totalLinesCount    = totalsData?.count ?? 0;

  const categoryPieData = categories.slice(0, 8).map((c, i) => ({
    name: c.category || 'Uncategorized', value: toNum(c.total_value), qty: toNum(c.total_qty), fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const branchBarData = displayBranches.map((b, i) => ({
    name: b.branch, qty: toNum(b.total_qty), value: toNum(b.total_value), fill: BRANCH_COLORS[i % BRANCH_COLORS.length],
  }));

  const productGroupMap = new Map<string, number>();
  lines.forEach((l: InventorySnapshotLine) => {
    if (l.product_code && !productGroupMap.has(l.product_code)) productGroupMap.set(l.product_code, productGroupMap.size);
  });
  const totalProductGroups = productGroupMap.size;

  function getInventoryRowStyle(row: InventorySnapshotLine, _i: number): React.CSSProperties {
    if (totalProductGroups <= 1) return {};
    const idx = productGroupMap.get(row.product_code ?? '') ?? 0;
    const t = idx / Math.max(1, totalProductGroups - 1);
    return { background: `rgba(${Math.round(99 + t * 40)},${Math.round(102 - t * 10)},${Math.round(241 + t * 5)},${parseFloat((0.04 + t * 0.07).toFixed(3))})` };
  }

  const snapshotOptions = snapshots.map(s => ({ key: s.id, label: `${s.source_file || s.label || 'Inventory'} — ${s.uploaded_at.split('T')[0]}` }));
  const branchOptions   = [{ key: 'all', label: 'All Branches' }, ...allBranches.map(b => ({ key: b.branch, label: b.branch }))];

  const columns = [
    { key: 'product_code', label: 'Code',       render: (row: InventorySnapshotLine) => <span style={{ fontFamily: 'monospace', fontSize: 11, color: css.mutedFg }}>{row.product_code}</span> },
    { key: 'product_name', label: 'Product',    render: (row: InventorySnapshotLine) => <div><p style={{ fontWeight: 600, fontSize: 13, margin: 0, color: css.cardFg }}>{row.product_name}</p>{row.product_category && <p style={{ fontSize: 11, color: css.mutedFg, margin: 0 }}>{row.product_category}</p>}</div> },
    { key: 'branch_name',  label: 'Branch',     render: (row: InventorySnapshotLine) => <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${C.indigo}15`, color: C.indigo, border: `1px solid ${C.indigo}30`, whiteSpace: 'nowrap' }}>{row.branch_name}</span> },
    { key: 'quantity',     label: 'Quantity',   render: (row: InventorySnapshotLine) => <span style={{ fontWeight: 700, fontSize: 13, color: css.cardFg }}>{formatNumber(toNum(row.quantity))}</span> },
    { key: 'unit_cost',    label: 'Unit Cost',  render: (row: InventorySnapshotLine) => <span style={{ fontSize: 13, color: css.cardFg }}>{formatCurrency(toNum(row.unit_cost))}</span> },
    { key: 'line_value',   label: 'Line Value', render: (row: InventorySnapshotLine) => <span style={{ fontWeight: 700, fontSize: 13, color: C.indigo }}>{formatCurrency(toNum(row.line_value))}</span> },
    { key: 'status',       label: 'Status',     render: (row: InventorySnapshotLine) => <StockStatusBadge quantity={toNum(row.quantity)} /> },
  ];

  const isLoading = snapsLoading || linesLoading || totalsLoading;

  return (
    <div style={{ background: css.bg, minHeight: '100vh', padding: '32px 28px' }}>

      {/* Header */}
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
            {snapshots.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${C.indigo}18`, color: C.indigo, border: `1px solid ${C.indigo}35` }}>{snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} available</span>}
          </p>
        </div>
        <button onClick={refetch} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 10, border: `1px solid ${css.border}`, background: css.card, color: css.cardFg, fontSize: 13, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Filters</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>Select a snapshot and optionally filter by branch — all KPIs and charts update automatically</p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StyledDropdown label="Snapshot" options={snapshotOptions} value={currentSnapId}
            onChange={v => { setSelectedSnapshotId(v); setSelectedBranch('all'); setTablePage(1); setTableSearch(''); }}
            isOpen={openDropdown === 'snapshot'} onToggle={() => setOpenDropdown(o => o === 'snapshot' ? null : 'snapshot')} onClose={() => setOpenDropdown(null)} />
          <StyledDropdown label="Branch" options={branchOptions} value={selectedBranch}
            onChange={v => { setSelectedBranch(v); setTablePage(1); setTableSearch(''); }}
            isOpen={openDropdown === 'branch'} onToggle={() => setOpenDropdown(o => o === 'branch' ? null : 'branch')} onClose={() => setOpenDropdown(null)} />
          {selectedBranch !== 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ height: 23 }} />
              <button onClick={() => { setSelectedBranch('all'); setTablePage(1); setTableSearch(''); }}
                style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${css.border}`, background: css.card, color: css.mutedFg, fontSize: 13, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', whiteSpace: 'nowrap' }}>
                Clear branch
              </button>
            </div>
          )}
        </div>
        {selectedBranch !== 'all' && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, background: `${C.indigo}10`, border: `1px solid ${C.indigo}25`, borderRadius: 20, padding: '4px 12px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.indigo, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.indigo, fontWeight: 600 }}>Filtered: {selectedBranch}</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Total Stock Value"  value={isLoading ? '…' : formatCurrency(totalValue)} sub={selectedBranch !== 'all' ? `Branch: ${selectedBranch}` : `Across ${allBranches.length} branch${allBranches.length !== 1 ? 'es' : ''}`} icon={Package}       accent={C.indigo} />
        <KpiCard label="Total Units"        value={isLoading ? '…' : formatNumber(totalQty)} sub="Total quantity in stock" icon={Package} accent={C.emerald} />
        <KpiCard label="Stock Alerts"       value={isLoading ? '…' : String(lowCount + outOfStockCount + criticalCount)} sub={`${outOfStockCount} out · ${criticalCount} critical · ${lowCount} low`} icon={AlertTriangle} accent={C.rose} />
      </div>

      {/* Branch Cards */}
      {!branchLoading && displayBranches.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedBranch !== 'all' ? '1fr' : 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
          {displayBranches.map((branch, i) => {
            const branchValue = toNum(branch.total_value);
            const branchQty   = toNum(branch.total_qty);
            const globalTotal = allBranches.reduce((s, b) => s + toNum(b.total_value), 0);
            const pct         = globalTotal > 0 ? (branchValue / globalTotal) * 100 : 0;
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

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Panel title="Stock Value by Branch" sub={selectedBranch !== 'all' ? `Branch: ${selectedBranch}` : 'Distribution of inventory value across branches'}>
          {branchBarData.length === 0 ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.mutedFg, fontSize: 13 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={branchBarData} barCategoryGap="30%" barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>{branchBarData.map((b, i) => (<linearGradient key={i} id={`inv-bg-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={b.fill} stopOpacity={1} /><stop offset="100%" stopColor={b.fill} stopOpacity={0.55} /></linearGradient>))}</defs>
                <CartesianGrid stroke={css.border} strokeWidth={1} vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} dy={4} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickCount={5} width={36} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <Bar dataKey="value" name="Stock Value" radius={[5, 5, 0, 0]} maxBarSize={22}>
                  {branchBarData.map((_, i) => <Cell key={i} fill={`url(#inv-bg-${i})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Stock by Category" sub={selectedBranch !== 'all' ? `Branch: ${selectedBranch}` : 'Value breakdown by product category'}>
          {categoryPieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={200} height={220}>
                  <PieChart>
                    <defs>{categoryPieData.map((c, i) => (<radialGradient key={i} id={`inv-cg-${i}`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={c.fill} stopOpacity={1} /><stop offset="100%" stopColor={c.fill} stopOpacity={0.75} /></radialGradient>))}</defs>
                    <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {categoryPieData.map((_, i) => <Cell key={i} fill={`url(#inv-cg-${i})`} />)}
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
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.mutedFg, fontSize: 13 }}>No category data available</div>
          )}
        </Panel>
      </div>

      {/* Inventory Lines Table */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Inventory Lines</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
            {currentSnap ? `${currentSnap.source_file || currentSnap.label || 'Import'} — uploaded ${currentSnap.uploaded_at.split('T')[0]}` : 'Select a snapshot above'}
            {selectedBranch !== 'all' && ` · Branch: ${selectedBranch}`}
          </p>
        </div>
        {linesError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
            <AlertTriangle size={32} style={{ color: C.rose }} />
            <p style={{ color: C.rose, fontSize: 14, margin: 0 }}>{linesError}</p>
            <button onClick={refetch} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', border: `1px solid ${css.border}`, color: css.mutedFg, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : linesLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 10, color: css.mutedFg }}>
            <Loader2 size={22} className="animate-spin" style={{ color: C.indigo }} />
            <span style={{ fontSize: 14 }}>Loading inventory lines…</span>
          </div>
        ) : lines.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10, color: css.mutedFg }}>
            <Package size={40} style={{ opacity: 0.25 }} />
            <p style={{ fontSize: 13, margin: 0 }}>No lines found for the selected filters.</p>
          </div>
        ) : (
          <DataTable data={lines} columns={columns} searchable exportable getRowStyle={getInventoryRowStyle}
            serverPagination={{ totalCount: linesData?.count ?? 0, page: tablePage, pageSize: 100, onPageChange: setTablePage, onSearch: (q) => { setTableSearch(q); setTablePage(1); } }}
          />
        )}
      </div>
    </div>
  );
}