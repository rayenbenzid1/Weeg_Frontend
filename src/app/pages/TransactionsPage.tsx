import { useState, useEffect } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DataTable } from '../components/DataTable';
import { formatCurrency, formatDate } from '../lib/utils';
import { Eye, ArrowUpRight } from 'lucide-react';
import { transactionsApi, Sale, Purchase } from '../lib/transactionsApi';

type TransactionWithType = (Sale | Purchase) & { type: 'sale' | 'purchase' };

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres (pour l'instant statiques, tu peux les connecter au backend plus tard)
  const [selectedPeriod, setSelectedPeriod] = useState('12m');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all');

  const pageSize = 20;

  // Statistiques sommaires (calculées côté frontend pour l'instant)
  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [avgTransaction, setAvgTransaction] = useState(0);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);

      try {
        // Récupérer les ventes
        const salesData = await transactionsApi.listSales({
          page: 1,
          page_size: pageSize,
          // Ajoute tes filtres quand le backend les supporte :
          // branch: selectedBranch !== 'all' ? selectedBranch : undefined,
          // product: selectedProduct !== 'all' ? selectedProduct : undefined,
          // date_from / date_to selon selectedPeriod
        });

        // Récupérer les achats
        const purchasesData = await transactionsApi.listPurchases({
          page: 1,
          page_size: pageSize,
          // mêmes filtres
        });

        // Combiner et trier par date descendante
        const combined = [
          ...salesData.results.map(s => ({ ...s, type: 'sale' as const })),
          ...purchasesData.results.map(p => ({ ...p, type: 'purchase' as const })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setTransactions(combined);

        // Calculs sommaires (sur la page courante – idéalement fais-le via un endpoint backend)
        const salesSum = salesData.results.reduce((sum, s) => sum + (s.total || 0), 0);
        const purchasesSum = purchasesData.results.reduce((sum, p) => sum + (p.total || 0), 0);

        setTotalSales(salesSum);
        setTotalPurchases(purchasesSum);
        setTransactionCount(salesData.count + purchasesData.count);
        setAvgTransaction(
          (salesSum + purchasesSum) / (salesData.count + purchasesData.count || 1)
        );
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedPeriod, selectedBranch, selectedProduct]);

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (row: TransactionWithType) => (
        <Badge variant={row.type === 'sale' ? 'default' : 'secondary'}>
          {row.type === 'sale' ? 'Sale' : 'Purchase'}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (row: any) => formatDate(row.date),
    },
    {
      key: 'invoice_number',
      label: 'Invoice',
      render: (row: any) => (
        <span className="font-mono text-sm">{row.invoice_number || '—'}</span>
      ),
    },
    {
      key: 'product_name',
      label: 'Product',
      render: (row: any) => (
        <div>
          <p className="font-medium">{row.product_name || row.material_name || '—'}</p>
          <p className="text-xs text-muted-foreground">
            {row.material_code || row.product?.sku || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'branch_name',
      label: 'Branch',
      render: (row: any) => row.branch_name || row.branch?.name || '—',
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row: any) => (row.type === 'sale' ? row.customer_name || '—' : '—'),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (row: any) => <span className="font-medium">{row.quantity || 0}</span>,
    },
    {
      key: 'unit_price',
      label: 'Unit Price',
      render: (row: any) => formatCurrency(row.unit_price || 0),
    },
    {
      key: 'total',
      label: 'Total Value',
      render: (row: any) => (
        <span className="font-semibold">{formatCurrency(row.total || 0)}</span>
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
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales & Purchases</h1>
        <p className="text-muted-foreground mt-1">
          Complete transaction history and analysis
        </p>
      </div>

      {/* Filters */}
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
                  {/* À remplacer par un fetch réel depuis branchesApi */}
                  {/* <SelectItem value="branch-uuid-1">Head Office</SelectItem> */}
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
                  {/* À remplacer par fetch depuis productsApi */}
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
              <ArrowUpRight className="h-3 w-3" /> 12.5% vs last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Purchases</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(totalPurchases)}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> 6.8% vs last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold mt-2">{transactionCount}</p>
            <p className="text-xs text-muted-foreground mt-1">This page / period</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Avg Transaction</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(avgTransaction)}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> 3.2% vs last period
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
        <div className="text-center py-12">Loading transactions...</div>
      ) : (
        <DataTable
          data={transactions}
          columns={columns}
          searchable
          exportable
          pageSize={pageSize}
        />
      )}
    </div>
  );
}