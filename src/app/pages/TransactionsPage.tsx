import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DataTable } from '../components/DataTable';
import { formatCurrency, formatDate, formatNumber } from '../lib/utils';
import {
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  Loader2, AlertTriangle, ChevronDown, RefreshCw,
} from 'lucide-react';
import axios from 'axios';
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  isSaleType,
  isPurchaseType,
} from '../lib/dataApi';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — Django DecimalField → string ("1.0000"). Toujours parser avant usage.
// ─────────────────────────────────────────────────────────────────────────────
const toNum = (val: unknown): number => parseFloat(String(val ?? 0)) || 0;

// ─────────────────────────────────────────────────────────────────────────────
// Labels étendus
// ─────────────────────────────────────────────────────────────────────────────
const ALL_LABELS: Record<string, string> = {
  ...MOVEMENT_TYPE_LABELS,
  'ف تسوية المخ': 'Inventory Adjustment',
  'نقل':           'Stock Transfer',
  'ف.أول المدة':   'Opening Balance',
  'اخراج رئيسي':  'Main Exit',
  'مردود شراء':    'Purchase Return',
  'مردود بيع':     'Sales Return',
  'ف.تالف': 'Damaged Goods', 'ف تالف': 'Damaged Goods', 'تالف': 'Damaged Goods',
  'ف.عينات': 'Samples', 'ف عينات': 'Samples', 'عينات': 'Samples',
};

function getLabel(rawType: string): string {
  return ALL_LABELS[rawType] ?? rawType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catégories UI
// ─────────────────────────────────────────────────────────────────────────────
type MovementCategory = 'sale' | 'purchase' | 'transfer' | 'adjustment' | 'other';

function getCategory(movementType: string): MovementCategory {
  if (isSaleType(movementType))        return 'sale';
  if (isPurchaseType(movementType))    return 'purchase';
  if (movementType === 'نقل')           return 'transfer';
  if (movementType === 'ف تسوية المخ') return 'adjustment';
  return 'other';
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand palette & CSS vars
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Badge colors
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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
  branch_name?:  string | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// StyledDropdown — portal-based, same as KPIEnginePage
// ─────────────────────────────────────────────────────────────────────────────
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
            width:      '100%',
            textAlign:  'left',
            padding:    '8px 12px',
            borderRadius: 8,
            border:     'none',
            cursor:     'pointer',
            fontSize:   13,
            background: value === opt.key ? `${C.indigo}15` : 'transparent',
            color:      value === opt.key ? C.indigo : '#111827',
            fontWeight: value === opt.key ? 600 : 400,
            display:    'flex',
            alignItems: 'center',
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
          width:      '100%',
          height:     38,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding:    '0 12px',
          borderRadius: 10,
          border:     `1px solid ${css.border}`,
          background: css.card,
          color:      css.cardFg,
          fontSize:   13,
          cursor:     'pointer',
          boxShadow:  '0 1px 3px rgba(0,0,0,0.06)',
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

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export function TransactionsPage() {
  const [transactions, setTransactions]           = useState<TransactionWithType[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState<string | null>(null);
  const [availableTypes, setAvailableTypes]       = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  const [selectedPeriod, setSelectedPeriod] = useState('12m');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedType,   setSelectedType]   = useState('all');

  // Dropdown open state — only one at a time
  const [openDropdown, setOpenDropdown] = useState<'period' | 'type' | 'branch' | null>(null);

  const [page, setPage]             = useState(1);
  const pageSize                    = 20;
  const [totalCount, setTotalCount] = useState(0);

  // ── KPI — totaux globaux via data.totals (calculés backend sur TOUT) ────
  // /api/transactions/?page=1&page_size=1 → totals.total_in_value / total_out_value
  const [grandTotalOut, setGrandTotalOut] = useState(0);
  const [grandTotalIn,  setGrandTotalIn]  = useState(0);
  const [kpiLoading,    setKpiLoading]    = useState(true);

  const fetchKPIs = useCallback(async () => {
    setKpiLoading(true);
    try {
      const token = localStorage.getItem('fasi_access_token');
      const { data } = await axios.get<PaginatedMovements>('/api/transactions/', {
        params:  { page: 1, page_size: 1 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const tOut = toNum(data.totals?.total_out_value);
      const tIn  = toNum(data.totals?.total_in_value);
      console.log('[KPI] totals from backend → OUT:', tOut, '| IN:', tIn);
      setGrandTotalOut(tOut);
      setGrandTotalIn(tIn);
    } catch (e) {
      console.error('[KPI] fetch error', e);
    } finally {
      setKpiLoading(false);
    }
  }, []);

  useEffect(() => { fetchKPIs(); }, [fetchKPIs]);

  const refetchKPIs = fetchKPIs;
  const netFlow = grandTotalIn - grandTotalOut;

  // Fetch movement types
  useEffect(() => {
    const token = localStorage.getItem('fasi_access_token');
    axios
      .get<{ movement_types: string[] }>('/api/transactions/movement-types/', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then(res => setAvailableTypes(res.data.movement_types))
      .catch(() => setAvailableTypes(Object.values(MOVEMENT_TYPES)));
  }, []);

  // Fetch branches
  useEffect(() => {
    const token = localStorage.getItem('fasi_access_token');
    axios
      .get<{ branches: string[] }>('/api/transactions/branches/', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then(res => setAvailableBranches(res.data.branches))
      .catch(() => setAvailableBranches([]));
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('fasi_access_token');
      const params: Record<string, any> = { page, page_size: pageSize };
      if (selectedType   !== 'all') params.movement_type = selectedType;
      if (selectedBranch !== 'all') params.branch        = selectedBranch;

      const { data } = await axios.get<PaginatedMovements>('/api/transactions/', {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const mapped: TransactionWithType[] = data.movements.map(m => ({
        ...m,
        category: getCategory(m.movement_type),
      }));

      mapped.sort(
        (a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()
      );

      setTransactions(mapped);
      setTotalCount(data.count);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, selectedPeriod, selectedBranch, selectedType]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Refresh handler — reloads both KPIs and transactions ─────────────────
  const handleRefresh = useCallback(() => {
    refetchKPIs?.();
    fetchTransactions();
  }, [refetchKPIs, fetchTransactions]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Dropdown options
  const periodOptions = [
    { key: '1m',  label: 'Last Month' },
    { key: '3m',  label: 'Last 3 Months' },
    { key: '6m',  label: 'Last 6 Months' },
    { key: '12m', label: 'Last 12 Months' },
    { key: 'ytd', label: 'Year to Date' },
  ];

  const typeOptions = [
    { key: 'all', label: 'All Types' },
    ...availableTypes.map(t => ({ key: t, label: getLabel(t) })),
  ];

  const branchOptions = [
    { key: 'all', label: 'All Branches' },
    ...availableBranches.map(b => ({ key: b, label: b })),
  ];

  // ── Colonnes du tableau ───────────────────────────────────────────────────
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
            {row.movement_type_display || getLabel(row.movement_type)}
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
          <p style={{ fontWeight: 600, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: css.cardFg }}
             title={row.material_name}>
            {row.material_name || '—'}
          </p>
          <p style={{ fontSize: 11, color: css.mutedFg, fontFamily: 'monospace', margin: 0 }}>{row.material_code || '—'}</p>
        </div>
      ),
    },
    {
      key: 'branch_name',
      label: 'Branch',
      render: (row: TransactionWithType) => (
        <span style={{ fontSize: 13, color: css.cardFg }}>{row.branch_name || '—'}</span>
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

  // ── Rendu ─────────────────────────────────────────────────────────────────
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
        {/* ── Refresh button — same style as KPIEnginePage ── */}
        <button
          onClick={handleRefresh}
          disabled={loading || kpiLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 16px', borderRadius: 10,
            border: `1px solid ${css.border}`, background: css.card,
            color: css.cardFg, fontSize: 13, cursor: loading || kpiLoading ? 'not-allowed' : 'pointer',
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

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>

        {/* Total Value Out — of Purchases (فاتورة شراء → total_out) */}
        <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: C.rose, opacity: 0.08, filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.rose}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={16} style={{ color: C.rose }} />
            </div>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>Total Value Out</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.rose, margin: '4px 0 0', letterSpacing: '-0.03em' }}>{formatCurrency(grandTotalOut)}</p>
          <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>of Sales (فاتورة بيع)</p>
        </div>

        {/* Total Value In — of Sales (فاتورة بيع → total_in) */}
        <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: C.emerald, opacity: 0.08, filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.emerald}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownLeft size={16} style={{ color: C.emerald }} />
            </div>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>Total Value In</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.emerald, margin: '4px 0 0', letterSpacing: '-0.03em' }}>{formatCurrency(grandTotalIn)}</p>
          <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>All movement types</p>
        </div>

        {/* Total Movements */}
        <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: C.indigo, opacity: 0.08, filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.indigo}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeftRight size={16} style={{ color: C.indigo }} />
            </div>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>Total Movements</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: css.cardFg, margin: '4px 0 0', letterSpacing: '-0.03em' }}>{formatNumber(totalCount)}</p>
          <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>Across all types</p>
        </div>

        {/* Net Flow */}
        <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: netFlow >= 0 ? C.emerald : C.rose, opacity: 0.08, filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${netFlow >= 0 ? C.emerald : C.rose}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeftRight size={16} style={{ color: netFlow >= 0 ? C.emerald : C.rose }} />
            </div>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, margin: 0 }}>Net Flow</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: netFlow >= 0 ? C.emerald : C.rose, margin: '4px 0 0', letterSpacing: '-0.03em' }}>
            {netFlow >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netFlow))}
          </p>
          <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>{netFlow >= 0 ? 'Net positive' : 'Net negative'}</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Filters</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>Customize your transaction view</p>
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
        </div>
      </div>

      {/* ── Legend ── */}
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

      {/* ── Table — même style que InventoryPage ── */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>Transaction Details</h3>
          <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
            Complete movement history across all branches
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
            <Loader2 size={22} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Loading transactions...</span>
          </div>
        ) : (
          <DataTable
            data={transactions}
            columns={columns}
            searchable
            exportable
            pageSize={pageSize}
          />
        )}

        {/* Pagination — style identique à InventoryPage */}
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${css.border}` }}>
            <p style={{ fontSize: 13, color: css.mutedFg, margin: 0 }}>
              Showing {formatNumber((page - 1) * pageSize + 1)} to {formatNumber(Math.min(page * pageSize, totalCount))} of {formatNumber(totalCount)} results
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, border: `1px solid ${css.border}`, background: css.card,
                  color: page === 1 ? css.mutedFg : css.cardFg,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span style={{ fontSize: 13, color: css.mutedFg, padding: '0 6px', whiteSpace: 'nowrap' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, border: `1px solid ${css.border}`, background: css.card,
                  color: page >= totalPages ? css.mutedFg : css.cardFg,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}