import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataTable } from '../components/DataTable';
import { formatCurrency, formatDate, formatNumber } from '../lib/utils';
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Loader2, AlertTriangle } from 'lucide-react';
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
// Labels étendus — couvre TOUS les types présents dans les données réelles
// ─────────────────────────────────────────────────────────────────────────────
const ALL_LABELS: Record<string, string> = {
  ...MOVEMENT_TYPE_LABELS,
  'ف تسوية المخ': 'Inventory Adjustment',
  'نقل':           'Stock Transfer',
  'ف.أول المدة':   'Opening Balance',
  'اخراج رئيسي':  'Main Exit',
  'مردود شراء':    'Purchase Return',
};

function getLabel(rawType: string): string {
  return ALL_LABELS[rawType] ?? rawType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catégories UI — 5 types distincts pour le color-coding
// ─────────────────────────────────────────────────────────────────────────────
type MovementCategory = 'sale' | 'purchase' | 'transfer' | 'adjustment' | 'other';

function getCategory(movementType: string): MovementCategory {
  if (isSaleType(movementType))         return 'sale';
  if (isPurchaseType(movementType))     return 'purchase';
  if (movementType === 'نقل')            return 'transfer';
  if (movementType === 'ف تسوية المخ')  return 'adjustment';
  return 'other';
}

const BADGE_STYLE: Record<MovementCategory, string> = {
  sale:       'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  purchase:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  transfer:   'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  adjustment: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  other:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const CATEGORY_LABEL: Record<MovementCategory, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  transfer: 'Stock Transfer',
  adjustment: 'Inventory Adjustment',
  other: 'Other',
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
  // Django DecimalField → sérialisé en string ("1.0000")
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
// Page
// ─────────────────────────────────────────────────────────────────────────────
export function TransactionsPage() {
  const [transactions, setTransactions]     = useState<TransactionWithType[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  // Filters
  const [selectedPeriod, setSelectedPeriod]   = useState('12m');
  const [selectedBranch, setSelectedBranch]   = useState('all');
  const [selectedType, setSelectedType]       = useState('all');

  const [page, setPage]           = useState(1);
  const pageSize                  = 20;
  const [totalCount, setTotalCount] = useState(0);

  // Totaux globaux (déjà des numbers dans data.totals, pas des DecimalField strings)
  const [totalIn, setTotalIn]   = useState(0);
  const [totalOut, setTotalOut] = useState(0);

  // ── Fetch movement types une seule fois ───────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('fasi_access_token');
    axios
      .get<{ movement_types: string[] }>('/api/transactions/movement-types/', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then(res => setAvailableTypes(res.data.movement_types))
      .catch(() => setAvailableTypes(Object.values(MOVEMENT_TYPES)));
  }, []);

  // ── Fetch branches une seule fois ─────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('fasi_access_token');
    axios
      .get<{ branches: string[] }>('/api/transactions/branches/', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then(res => setAvailableBranches(res.data.branches))
      .catch(() => setAvailableBranches([]));
  }, []);

  // ── Fetch transactions ────────────────────────────────────────────────
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('fasi_access_token');
        const params: Record<string, any> = { page, page_size: pageSize };
        if (selectedType !== 'all') params.movement_type = selectedType;
        if (selectedBranch !== 'all') params.branch = selectedBranch;
        // TODO: brancher product, period quand le backend les supporte

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
        setTotalIn(toNum(data.totals.total_in_value));
        setTotalOut(toNum(data.totals.total_out_value));
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [page, selectedPeriod, selectedBranch, selectedType]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const netFlow    = totalIn - totalOut;

  // ── Colonnes du tableau ────────────────────────────────────────────────
  const columns = [
    {
      key: 'movement_type',
      label: 'Type',
      render: (row: TransactionWithType) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${BADGE_STYLE[row.category]}`}>
          {row.movement_type_display || getLabel(row.movement_type)}
        </span>
      ),
    },
    {
      key: 'movement_date',
      label: 'Date',
      render: (row: TransactionWithType) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(row.movement_date)}
        </span>
      ),
    },
    {
      key: 'material_name',
      label: 'Product / Material',
      render: (row: TransactionWithType) => (
        <div className="max-w-[240px]">
          <p className="font-medium text-sm truncate" title={row.material_name}>
            {row.material_name || '—'}
          </p>
          <p className="text-xs text-muted-foreground font-mono">{row.material_code || '—'}</p>
        </div>
      ),
    },
    {
      key: 'branch_name',
      label: 'Branch',
      render: (row: TransactionWithType) => (
        <span className="text-sm">{row.branch_name || '—'}</span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: TransactionWithType) => (
        <span className="text-sm text-muted-foreground">{row.customer_name || '—'}</span>
      ),
    },
    {
      key: 'qty',
      label: 'Qty In / Out',
      render: (row: TransactionWithType) => {
        const qIn  = toNum(row.qty_in);
        const qOut = toNum(row.qty_out);
        return (
          <div className="text-sm font-mono whitespace-nowrap">
            {qIn  > 0 && <span className="text-green-600 font-semibold">+{formatNumber(qIn)}</span>}
            {qIn  > 0 && qOut > 0 && <span className="text-muted-foreground mx-1">/</span>}
            {qOut > 0 && <span className="text-red-500 font-semibold">-{formatNumber(qOut)}</span>}
            {qIn === 0 && qOut === 0 && <span className="text-muted-foreground">—</span>}
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
          ? <span className="text-green-600 font-semibold text-sm">{formatCurrency(v)}</span>
          : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      key: 'total_out',
      label: 'Value Out',
      render: (row: TransactionWithType) => {
        const v = toNum(row.total_out);
        return v > 0
          ? <span className="text-red-500 font-semibold text-sm">{formatCurrency(v)}</span>
          : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      key: 'balance_price',
      label: 'Unit Price',
      render: (row: TransactionWithType) => {
        const v = toNum(row.balance_price);
        return v > 0
          ? <span className="text-sm">{formatCurrency(v)}</span>
          : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
  ];

  // ── Rendu ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground mt-1">Complete movement history across all branches</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Value In</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(totalIn)}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowDownLeft className="h-3 w-3 text-green-600" /> Purchases &amp; entries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Value Out</p>
            <p className="text-2xl font-bold mt-1 text-red-500">{formatCurrency(totalOut)}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-red-500" /> Sales &amp; exits
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Movements</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(totalCount)}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Flow</p>
            <p className={`text-2xl font-bold mt-1 ${netFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {netFlow >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netFlow))}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              {netFlow >= 0 ? 'Net positive' : 'Net negative'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize your transaction view</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Period</label>
              <Select value={selectedPeriod} onValueChange={v => { setSelectedPeriod(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">Last Month</SelectItem>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="12m">Last 12 Months</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Movement Type</label>
              <Select value={selectedType} onValueChange={v => { setSelectedType(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableTypes.map(rawType => (
                    <SelectItem key={rawType} value={rawType}>
                      {getLabel(rawType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Branch</label>
              <Select value={selectedBranch} onValueChange={v => { setSelectedBranch(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {availableBranches.map(branch => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Légende des types */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">Legend:</span>
        {(Object.keys(CATEGORY_LABEL) as MovementCategory[]).map(cat => (
          <span key={cat} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BADGE_STYLE[cat]}`}>
            {CATEGORY_LABEL[cat]}
          </span>
        ))}
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md dark:bg-red-950 dark:border-red-800 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading transactions...
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            data={transactions}
            columns={columns}
            searchable
            exportable
            pageSize={pageSize}
          />

          {/* Pagination */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} — {formatNumber(totalCount)} total movements
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}