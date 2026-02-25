import { useState, useEffect } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataTable } from '../components/DataTable';
import { formatCurrency, formatDate } from '../lib/utils';
import { Eye, ArrowUpRight } from 'lucide-react';
import axios from 'axios';

// ─────────────────────────────────────────────
// Types alignés avec le backend
// ─────────────────────────────────────────────

interface Movement {
  id: string;
  movement_date: string;
  movement_type: string;
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

type TransactionWithType = Movement & { type: 'sale' | 'purchase' | 'other' };

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres UI (pas encore envoyés au backend)
  const [selectedPeriod, setSelectedPeriod] = useState('12m');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all');

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);

  // Statistiques (utilisation des totaux envoyés par le backend quand possible)
  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [avgTransaction, setAvgTransaction] = useState(0);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('fasi_access_token');

        const response = await axios.get<PaginatedMovements>('/api/transactions/', {
          params: {
            page,
            page_size: pageSize,
            // Tu peux décommenter quand tu actives les filtres côté backend
            // movement_type: 'sale',           // ou 'purchase', ou rien pour tout
            // branch_name__icontains: selectedBranch !== 'all' ? selectedBranch : undefined,
            // search: selectedProduct !== 'all' ? selectedProduct : undefined,
            // date_from: ... (à calculer selon selectedPeriod)
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = response.data;

        // Mapper pour ajouter le type visuel
        const mapped = data.movements.map((m) => {
          let type: 'sale' | 'purchase' | 'other' = 'other';
          if (['sale', 'sales_return'].includes(m.movement_type)) {
            type = 'sale';
          } else if (['purchase', 'purchase_return', 'main_entry'].includes(m.movement_type)) {
            type = 'purchase';
          }
          return { ...m, type };
        });

        // Tri par date descendante (optionnel si le backend le fait déjà)
        mapped.sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());

        setTransactions(mapped);
        setTotalCount(data.count);

        // Utilisation des totaux globaux envoyés par le backend
        // (sur tout le queryset filtré, pas seulement la page courante)
        setTotalSales(data.totals.total_out_value || 0);     // ventes → total_out
        setTotalPurchases(data.totals.total_in_value || 0);  // achats → total_in
        setTransactionCount(data.count);
        setAvgTransaction(
          (data.totals.total_out_value + data.totals.total_in_value) /
            (data.count || 1)
        );
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [page, selectedPeriod, selectedBranch, selectedProduct]);

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (row: TransactionWithType) => (
        <Badge
          variant={
            row.type === 'sale'
              ? 'default'
              : row.type === 'purchase'
              ? 'secondary'
              : 'outline'
          }
        >
          {row.movement_type_display || row.type.charAt(0).toUpperCase() + row.type.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (row: any) => formatDate(row.movement_date),
    },
    {
      key: 'material',
      label: 'Product / Material',
      render: (row: any) => (
        <div>
          <p className="font-medium">{row.material_name || '—'}</p>
          <p className="text-xs text-muted-foreground">{row.material_code || '—'}</p>
        </div>
      ),
    },
    {
      key: 'branch',
      label: 'Branch',
      render: (row: any) => row.branch_name || '—',
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row: any) => row.customer_name || '—',
    },
    {
      key: 'qty',
      label: 'Qty In / Out',
      render: (row: any) => (
        <span>
          {row.qty_in ? `+${row.qty_in}` : ''}{' '}
          {row.qty_out ? `-${row.qty_out}` : ''}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: any) => (
        <span className="font-semibold">
          {formatCurrency((row.total_out || row.total_in || 0))}
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
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales & Purchases</h1>
        <p className="text-muted-foreground mt-1">
          Complete transaction history and analysis
        </p>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize your transaction view</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
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
              <label className="text-sm font-medium mb-2 block">Branch</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {/* À remplir dynamiquement via API branches */}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Product</label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {/* À remplir dynamiquement via API products */}
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
            <p className="text-xs text-muted-foreground mt-1">Current page</p>
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
          {error}
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
          
          {/* Custom Pagination Controls */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing page {page} of {Math.ceil(totalCount / pageSize)} ({totalCount} total)
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