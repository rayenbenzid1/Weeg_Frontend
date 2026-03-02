import { useState, useEffect } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataTable } from '../components/DataTable';
import { formatCurrency, formatDate } from '../lib/utils';
import { Eye, ArrowUpRight } from 'lucide-react';
import axios from 'axios';
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  isSaleType,
  isPurchaseType,
  getMovementTypeLabel,
} from '../lib/dataApi';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Movement {
  id: string;
  movement_date: string;
  /** Raw Arabic label, e.g. "ف بيع" */
  movement_type: string;
  /** Friendly English label from serializer */
  movement_type_display?: string;
  material_code: string;
  material_name: string;
  qty_in?: number;
  qty_out?: number;
  total_in?: number;
  total_out?: number;
  branch_name?: string;
  customer_name?: string;
}

interface PaginatedMovements {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  totals: {
    total_in_value: number;
    total_out_value: number;
  };
  movements: Movement[];
}

type MovementCategory = 'sale' | 'purchase' | 'other';

type TransactionWithType = Movement & { category: MovementCategory };

/** Derive a UI category from the raw Arabic movement_type */
function getCategory(movementType: string): MovementCategory {
  if (isSaleType(movementType)) return 'sale';
  if (isPurchaseType(movementType)) return 'purchase';
  return 'other';
}

// ─────────────────────────────────────────────
// Badge variant per category
// ─────────────────────────────────────────────

const CATEGORY_BADGE_VARIANT: Record<MovementCategory, 'default' | 'secondary' | 'outline'> = {
  sale:     'default',
  purchase: 'secondary',
  other:    'outline',
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Available movement types fetched dynamically from the backend
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // Filters
  const [selectedPeriod, setSelectedPeriod]     = useState('12m');
  const [selectedBranch, setSelectedBranch]     = useState('all');
  const [selectedProduct, setSelectedProduct]   = useState('all');
  const [selectedType, setSelectedType]         = useState('all');

  const [page, setPage]           = useState(1);
  const pageSize                  = 20;
  const [totalCount, setTotalCount] = useState(0);

  // Summary stats
  const [totalSales, setTotalSales]         = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [avgTransaction, setAvgTransaction] = useState(0);

  // ── Fetch available movement types once ──────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('fasi_access_token');
    axios
      .get<{ movement_types: string[] }>('/api/transactions/movement-types/', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then(res => setAvailableTypes(res.data.movement_types))
      .catch(() => {
        // Fall back to known constants if endpoint is not yet deployed
        setAvailableTypes(Object.values(MOVEMENT_TYPES));
      });
  }, []);

  // ── Fetch transactions ───────────────────────────────────────────────
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('fasi_access_token');

        const params: Record<string, any> = {
          page,
          page_size: pageSize,
        };

        // Only send movement_type filter when the user selected a specific type
        if (selectedType !== 'all') {
          params.movement_type = selectedType;
        }

        // TODO: wire up branch, product, period filters when backend supports them

        const response = await axios.get<PaginatedMovements>('/api/transactions/', {
          params,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = response.data;

        // Enrich with UI category derived from raw Arabic movement_type
        const mapped: TransactionWithType[] = data.movements.map(m => ({
          ...m,
          category: getCategory(m.movement_type),
        }));

        // Sort newest first (backend may already do this, but ensure consistency)
        mapped.sort(
          (a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()
        );

        setTransactions(mapped);
        setTotalCount(data.count);

        setTotalSales(data.totals.total_out_value || 0);
        setTotalPurchases(data.totals.total_in_value || 0);
        setTransactionCount(data.count);
        setAvgTransaction(
          (data.totals.total_out_value + data.totals.total_in_value) / (data.count || 1)
        );
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [page, selectedPeriod, selectedBranch, selectedProduct, selectedType]);

  // ── Table columns ────────────────────────────────────────────────────
  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (row: TransactionWithType) => (
        <Badge variant={CATEGORY_BADGE_VARIANT[row.category]}>
          {/* Prefer the serializer-provided display label; fall back to our label map */}
          {row.movement_type_display || getMovementTypeLabel(row.movement_type)}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (row: TransactionWithType) => formatDate(row.movement_date),
    },
    {
      key: 'material',
      label: 'Product / Material',
      render: (row: TransactionWithType) => (
        <div>
          <p className="font-medium">{row.material_name || '—'}</p>
          <p className="text-xs text-muted-foreground">{row.material_code || '—'}</p>
        </div>
      ),
    },
    {
      key: 'branch',
      label: 'Branch',
      render: (row: TransactionWithType) => row.branch_name || '—',
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row: TransactionWithType) => row.customer_name || '—',
    },
    {
      key: 'qty',
      label: 'Qty In / Out',
      render: (row: TransactionWithType) => (
        <span>
          {row.qty_in  ? `+${row.qty_in}`  : ''}
          {row.qty_out ? ` -${row.qty_out}` : ''}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: TransactionWithType) => (
        <span className="font-semibold">
          {formatCurrency(row.total_out || row.total_in || 0)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
          Completed
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales & Purchases</h1>
        <p className="text-muted-foreground mt-1">Complete transaction history and analysis</p>
      </div>

      {/* Filters */}
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
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableTypes.map(rawType => (
                    <SelectItem key={rawType} value={rawType}>
                      {/* Show English label; Arabic raw value sent to backend */}
                      {MOVEMENT_TYPE_LABELS[rawType] ?? rawType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Branch</label>
              <Select value={selectedBranch} onValueChange={v => { setSelectedBranch(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Product</label>
              <Select value={selectedProduct} onValueChange={v => { setSelectedProduct(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(totalSales)}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> vs last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Purchases</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(totalPurchases)}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> vs last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold mt-2">{transactionCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Total records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Avg Transaction</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(avgTransaction)}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> vs last period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          No data available. Please adjust your filters or try again later.
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} / {Math.ceil(totalCount / pageSize)} ({totalCount} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                disabled={page >= Math.ceil(totalCount / pageSize)}
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