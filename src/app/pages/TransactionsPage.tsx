// src/app/pages/TransactionsPage.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DataTable } from '../components/DataTable';
import { formatCurrency, formatDate, formatNumber } from '../lib/utils';
import {
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  Loader2, AlertTriangle, ChevronDown, RefreshCw,
} from 'lucide-react';
import axios from 'axios';
import { isSaleType, isPurchaseType } from '../lib/dataApi';

const toNum = (val: unknown): number => parseFloat(String(val ?? 0)) || 0;

type MovementCategory = 'sale' | 'purchase' | 'transfer' | 'adjustment' | 'other';

function getCategory(movementType: string): MovementCategory {
  if (isSaleType(movementType))        return 'sale';
  if (isPurchaseType(movementType))    return 'purchase';
  if (movementType === 'نقل')           return 'transfer';
  if (movementType === 'ف تسوية المخ') return 'adjustment';
  return 'other';
}

// ── Period → date range helper ─────────────────────────────────────────────
function periodToDates(period: string): { date_from?: string; date_to?: string } {
  if (period === 'all') return {};
  const today = new Date();
  const pad   = (n: number) => String(n).padStart(2, '0');
  const fmt   = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateTo = fmt(today);

  if (period === '1m')  { const f = new Date(today); f.setMonth(f.getMonth() - 1);         return { date_from: fmt(f), date_to: dateTo }; }
  if (period === '3m')  { const f = new Date(today); f.setMonth(f.getMonth() - 3);         return { date_from: fmt(f), date_to: dateTo }; }
  if (period === '6m')  { const f = new Date(today); f.setMonth(f.getMonth() - 6);         return { date_from: fmt(f), date_to: dateTo }; }
  if (period === '12m') { const f = new Date(today); f.setFullYear(f.getFullYear() - 1);   return { date_from: fmt(f), date_to: dateTo }; }
  if (period === 'ytd') return { date_from: `${today.getFullYear()}-01-01`, date_to: dateTo };
  return {};
}

// ── Brand palette ──────────────────────────────────────────────────────────
const C = {
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  orange:  '#f97316',
  rose:    '#f43f5e',
  cyan:    '#0ea5e9',
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

const BADGE_ACCENT: Record<MovementCategory, string> = {
  sale:       C.emerald,
  purchase:   C.cyan,
  transfer:   C.violet,
  adjustment: C.orange,
  other:      '#94a3b8',
};

const CATEGORY_LABEL: Record<MovementCategory, string> = {
  sale:       'Sale',
  purchase:   'Purchase',
  transfer:   'Stock Transfer',
  adjustment: 'Inventory Adjustment',
  other:      'Other',
};

// ── Types ──────────────────────────────────────────────────────────────────
interface Movement {
  id: string;
  movement_date: string;
  movement_type: string;
  movement_type_display?: string;
  material_code: string;
  material_name: string;
  qty_in:        number | string;
  qty_out:       number | string;
  total_in:      number | string;
  total_out:     number | string;
  balance_price: number | string;
  branch_name_resolved?: string | null;
  customer_name?: string | null;
}

interface PaginatedMovements {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  totals: { total_in_value: number; total_out_value: number };
  movements: Movement[];
}

type TransactionWithType = Movement & { category: MovementCategory };

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
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 160 }}>
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

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden', borderTop: `3px solid ${accent}`, paddingTop: 20 }}>
      <div style={{
        position: 'absolute', bottom: -20, right: -20,
        width: 90, height: 90, borderRadius: '50%',
        background: accent, opacity: 0.06, pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: `${accent}15`, border: `1px solid ${accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 10, fontWeight: 700,
          color: C.emerald, background: `${C.emerald}12`,
          border: `1px solid ${C.emerald}25`,
          padding: '3px 8px', borderRadius: 20,
        }}>
          <ArrowUpRight size={10} />
          live
        </div>
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 800, color: css.cardFg, marginTop: 5, marginBottom: 4, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: css.mutedFg, marginBottom: 14 }}>{sub}</p>}
      {!sub && <div style={{ marginBottom: 14 }} />}
      <div style={{ height: 3, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: '64%', background: `linear-gradient(90deg, ${accent}60, ${accent})` }} />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function TransactionsPage() {
  const [transactions, setTransactions]           = useState<TransactionWithType[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState<string | null>(null);
  const [availableTypes, setAvailableTypes]       = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  // ✅ All 3 filters — each one re-fetches both KPIs and table data
  const [selectedPeriod, setSelectedPeriod] = useState('12m');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedType,   setSelectedType]   = useState('all');
  const [openDropdown,   setOpenDropdown]   = useState<'period' | 'type' | 'branch' | null>(null);

  const [page,       setPage]       = useState(1);
  const pageSize                    = 50;
  const [totalCount, setTotalCount] = useState(0);

  // ✅ KPI totals derived from filtered API response (no separate KPI call needed)
  const [grandTotalOut, setGrandTotalOut] = useState(0);
  const [grandTotalIn,  setGrandTotalIn]  = useState(0);
  const [kpiLoading,    setKpiLoading]    = useState(true);

  // Compute date range from period selection
  const dateRange = useMemo(() => periodToDates(selectedPeriod), [selectedPeriod]);

  function getAuthHeaders() {
    const token = localStorage.getItem('fasi_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Load available movement types and branches once on mount
  useEffect(() => {
    const h = getAuthHeaders();
    axios.get('/api/transactions/movement-types/', { headers: h })
      .then(res => setAvailableTypes(res.data.movement_types ?? [])).catch(() => {});
    axios.get('/api/transactions/branches/', { headers: h })
      .then(res => setAvailableBranches(res.data.branches ?? [])).catch(() => {});
  }, []);

  // ✅ Single fetch function — applies ALL 3 filters simultaneously
  // KPI totals come from the same response (totals field), so they always
  // reflect exactly the same data as the table.
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setKpiLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, page_size: pageSize };

      // Movement type filter
      if (selectedType !== 'all') params.movement_type = selectedType;

      // Branch filter — exact match
      if (selectedBranch !== 'all') params.branch = selectedBranch;

      // Period → date_from / date_to
      if (dateRange.date_from) params.date_from = dateRange.date_from;
      if (dateRange.date_to)   params.date_to   = dateRange.date_to;

      const { data } = await axios.get<PaginatedMovements>('/api/transactions/', {
        params,
        headers: getAuthHeaders(),
      });

      const mapped: TransactionWithType[] = data.movements.map(m => ({
        ...m, category: getCategory(m.movement_type),
      }));
      mapped.sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());

      setTransactions(mapped);
      setTotalCount(data.count);

      // ✅ KPI cards get values directly from the filtered response totals
      setGrandTotalOut(toNum(data.totals?.total_out_value));
      setGrandTotalIn(toNum(data.totals?.total_in_value));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setKpiLoading(false);
    }
  }, [page, selectedPeriod, selectedBranch, selectedType, dateRange]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1); }, [selectedPeriod, selectedBranch, selectedType]);

  const netFlow    = grandTotalOut - grandTotalIn;
  const totalPages = Math.ceil(totalCount / pageSize);

  const isFiltered = selectedPeriod !== '12m' || selectedBranch !== 'all' || selectedType !== 'all';

  const periodOptions = [
    { key: 'all', label: 'All Time'        },
    { key: '1m',  label: 'Last Month'      },
    { key: '3m',  label: 'Last 3 Months'  },
    { key: '6m',  label: 'Last 6 Months'  },
    { key: '12m', label: 'Last 12 Months' },
    { key: 'ytd', label: 'Year to Date'   },
  ];
  const typeOptions   = [{ key: 'all', label: 'All Types'    }, ...availableTypes.map(t => ({ key: t, label: t }))];
  const branchOptions = [{ key: 'all', label: 'All Branches' }, ...availableBranches.map(b => ({ key: b, label: b }))];

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'movement_type',
      label: 'Type',
      render: (row: TransactionWithType) => {
        const accent = BADGE_ACCENT[row.category];
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 8px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            background: `${accent}18`, color: accent, border: `1px solid ${accent}35`,
          }}>
            {row.movement_type_display || row.movement_type}
          </span>
        );
      },
    },
    {
      key: 'movement_date',
      label: 'Date',
      render: (row: TransactionWithType) => (
        <span style={{ fontSize: 13, color: css.mutedFg, whiteSpace: 'nowrap' }}>
          {formatDate(row.movement_date)}
        </span>
      ),
    },
    {
      key: 'material_name',
      label: 'Product / Material',
      render: (row: TransactionWithType) => (
        <div style={{ maxWidth: 240 }}>
          <p style={{ fontWeight: 600, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: css.cardFg }} title={row.material_name}>
            {row.material_name || '—'}
          </p>
          <p style={{ fontSize: 11, color: css.mutedFg, fontFamily: 'monospace', margin: 0 }}>{row.material_code || '—'}</p>
        </div>
      ),
    },
    {
      key: 'branch_name_resolved',
      label: 'Branch',
      render: (row: TransactionWithType) => (
        <span style={{ fontSize: 13, color: css.cardFg }}>{(row as any).branch_name_resolved || '—'}</span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: TransactionWithType) => (
        <span style={{ fontSize: 13, color: css.mutedFg }}>{row.customer_name || '—'}</span>
      ),
    },
    {
      key: 'qty',
      label: 'Qty In / Out',
      render: (row: TransactionWithType) => {
        const qIn  = toNum(row.qty_in);
        const qOut = toNum(row.qty_out);
        return (
          <div style={{ fontSize: 13, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {qIn  > 0 && <span style={{ color: C.emerald, fontWeight: 700 }}>+{formatNumber(qIn)}</span>}
            {qIn  > 0 && qOut > 0 && <span style={{ color: css.mutedFg, margin: '0 4px' }}>/</span>}
            {qOut > 0 && <span style={{ color: C.rose, fontWeight: 700 }}>-{formatNumber(qOut)}</span>}
            {qIn === 0 && qOut === 0 && <span style={{ color: css.mutedFg }}>—</span>}
          </div>
        );
      },
    },
    {
      key: 'total_in',
      label: 'Value In',
      render: (row: TransactionWithType) => {
        const v = toNum(row.total_in);
        return v > 0
          ? <span style={{ color: C.emerald, fontWeight: 700, fontSize: 13 }}>{formatCurrency(v)}</span>
          : <span style={{ color: css.mutedFg, fontSize: 12 }}>—</span>;
      },
    },
    {
      key: 'total_out',
      label: 'Value Out',
      render: (row: TransactionWithType) => {
        const v = toNum(row.total_out);
        return v > 0
          ? <span style={{ color: C.rose, fontWeight: 700, fontSize: 13 }}>{formatCurrency(v)}</span>
          : <span style={{ color: css.mutedFg, fontSize: 12 }}>—</span>;
      },
    },
    {
      key: 'balance_price',
      label: 'Unit Price',
      render: (row: TransactionWithType) => {
        const v = toNum(row.balance_price);
        return v > 0
          ? <span style={{ fontSize: 13, color: css.cardFg }}>{formatCurrency(v)}</span>
          : <span style={{ color: css.mutedFg, fontSize: 12 }}>—</span>;
      },
    },
  ];

  return (
    <div style={{ background: css.bg, minHeight: '100vh', padding: '32px 28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: css.fg, letterSpacing: '-0.03em', margin: 0 }}>
            Transactions
          </h1>
          <p style={{ fontSize: 13, color: css.mutedFg, marginTop: 4 }}>
            Complete movement history across all branches
          </p>
        </div>
        <button
          onClick={fetchTransactions}
          disabled={loading || kpiLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 16px', borderRadius: 10,
            border: `1px solid ${css.border}`, background: css.card,
            color: css.cardFg, fontSize: 13,
            cursor: loading || kpiLoading ? 'not-allowed' : 'pointer',
            opacity: loading || kpiLoading ? 0.6 : 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {loading || kpiLoading
            ? <Loader2 size={14} className="animate-spin" />
            : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* ✅ KPI Cards — values come from the same filtered API response as the table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard
          label="Total Value Out"
          value={kpiLoading ? '…' : formatCurrency(grandTotalOut)}
          sub={selectedBranch !== 'all' ? `Branch: ${selectedBranch}` : 'Sales (filtered)'}
          icon={ArrowUpRight}
          accent={C.rose}
        />
        <KpiCard
          label="Total Value In"
          value={kpiLoading ? '…' : formatCurrency(grandTotalIn)}
          sub={selectedBranch !== 'all' ? `Branch: ${selectedBranch}` : 'All movement types'}
          icon={ArrowDownLeft}
          accent={C.emerald}
        />
        <KpiCard
          label="Total Movements"
          value={kpiLoading ? '…' : formatNumber(totalCount)}
          sub={[selectedBranch !== 'all' ? selectedBranch : '', selectedType !== 'all' ? selectedType : ''].filter(Boolean).join(' · ') || 'All filters'}
          icon={ArrowLeftRight}
          accent={C.indigo}
        />
        <KpiCard
          label="Net Flow"
          value={kpiLoading ? '…' : `${netFlow >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netFlow))}`}
          sub={netFlow >= 0 ? 'Net positive' : 'Net negative'}
          icon={ArrowLeftRight}
          accent={netFlow >= 0 ? C.emerald : C.rose}
        />
      </div>

      {/* ✅ Filters — all 3 affect KPI cards + table */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Filters</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
            All KPI cards and the table update automatically when filters change
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StyledDropdown
            label="Period"
            options={periodOptions}
            value={selectedPeriod}
            onChange={v => { setSelectedPeriod(v); setPage(1); }}
            isOpen={openDropdown === 'period'}
            onToggle={() => setOpenDropdown(o => o === 'period' ? null : 'period')}
            onClose={() => setOpenDropdown(null)}
          />
          <StyledDropdown
            label="Movement Type"
            options={typeOptions}
            value={selectedType}
            onChange={v => { setSelectedType(v); setPage(1); }}
            isOpen={openDropdown === 'type'}
            onToggle={() => setOpenDropdown(o => o === 'type' ? null : 'type')}
            onClose={() => setOpenDropdown(null)}
          />
          <StyledDropdown
            label="Branch"
            options={branchOptions}
            value={selectedBranch}
            onChange={v => { setSelectedBranch(v); setPage(1); }}
            isOpen={openDropdown === 'branch'}
            onToggle={() => setOpenDropdown(o => o === 'branch' ? null : 'branch')}
            onClose={() => setOpenDropdown(null)}
          />
          {isFiltered && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ height: 23 }} />
              <button
                onClick={() => { setSelectedPeriod('12m'); setSelectedBranch('all'); setSelectedType('all'); setPage(1); }}
                style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${css.border}`, background: css.card, color: css.mutedFg, fontSize: 13, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', whiteSpace: 'nowrap' }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
        {/* Active filter badges */}
        {isFiltered && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {selectedPeriod !== '12m' && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${C.indigo}10`, color: C.indigo, border: `1px solid ${C.indigo}25` }}>
                {periodOptions.find(o => o.key === selectedPeriod)?.label}
              </span>
            )}
            {selectedType !== 'all' && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${C.amber}10`, color: C.amber, border: `1px solid ${C.amber}25` }}>
                {selectedType}
              </span>
            )}
            {selectedBranch !== 'all' && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${C.cyan}10`, color: C.cyan, border: `1px solid ${C.cyan}25` }}>
                {selectedBranch}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: css.mutedFg }}>Legend:</span>
        {(Object.keys(CATEGORY_LABEL) as MovementCategory[]).map(cat => {
          const accent = BADGE_ACCENT[cat];
          return (
            <span key={cat} style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 10px', borderRadius: 20,
              fontSize: 11, fontWeight: 600,
              background: `${accent}18`, color: accent, border: `1px solid ${accent}35`,
            }}>
              {CATEGORY_LABEL[cat]}
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Transaction Details</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
            {formatNumber(totalCount)} transactions
            {selectedBranch !== 'all' && ` · Branch: ${selectedBranch}`}
            {selectedType !== 'all' && ` · Type: ${selectedType}`}
          </p>
        </div>

        {error ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: `${C.rose}10`, border: `1px solid ${C.rose}40`,
            color: C.rose, padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 10, color: css.mutedFg }}>
            <Loader2 size={22} className="animate-spin" style={{ color: C.indigo }} />
            <span style={{ fontSize: 14 }}>Loading transactions…</span>
          </div>
        ) : (
          <DataTable data={transactions} columns={columns} searchable exportable pageSize={pageSize} />
        )}

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${css.border}` }}>
            <p style={{ fontSize: 13, color: css.mutedFg, margin: 0 }}>
              Showing {formatNumber((page - 1) * pageSize + 1)} to {formatNumber(Math.min(page * pageSize, totalCount))} of {formatNumber(totalCount)} results
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${css.border}`, background: css.card, color: page === 1 ? css.mutedFg : css.cardFg, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span style={{ fontSize: 13, color: css.mutedFg, padding: '0 6px', whiteSpace: 'nowrap' }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${css.border}`, background: css.card, color: page >= totalPages ? css.mutedFg : css.cardFg, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}