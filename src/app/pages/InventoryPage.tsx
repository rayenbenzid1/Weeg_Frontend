import { useState } from 'react';
import { Package, AlertTriangle, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { DataTable } from '../components/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  useInventory,
  useInventoryDates,
  useBranchSummary,
  useCategoryBreakdown,
  type InventoryItem,
} from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

// ── Branch columns ───────────────────────────────────────────────────────

const BRANCH_KEYS: { key: keyof InventoryItem; label: string; valueKey: keyof InventoryItem }[] = [
  { key: 'qty_alkarimia', label: 'Al-Karimia', valueKey: 'value_alkarimia' },
  { key: 'qty_benghazi', label: 'Benghazi', valueKey: 'value_alkarimia' }, // adjust if separate
  { key: 'qty_mazraa', label: 'Mazraa', valueKey: 'value_mazraa' },
  { key: 'qty_dahmani', label: 'Dahmani', valueKey: 'value_dahmani' },
  { key: 'qty_janzour', label: 'Janzour', valueKey: 'value_janzour' },
  { key: 'qty_misrata', label: 'Misrata', valueKey: 'value_misrata' },
];

const BRANCH_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const CATEGORY_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function StockStatusBadge({ qty, total }: { qty: number; total: number }) {
  const pct = total > 0 ? (qty / total) * 100 : 0;
  if (pct === 0) return <Badge variant="destructive" className="text-xs">Out of Stock</Badge>;
  if (pct < 10) return <Badge variant="destructive" className="text-xs">🔴 Critical</Badge>;
  if (pct < 25) return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">🟡 Low</Badge>;
  return <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">🟢 Normal</Badge>;
}

export function InventoryPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeBranchTab, setActiveBranchTab] = useState<string>('all');

  // ── Data hooks ─────────────────────────────────────────────────────────
  const { data: datesData } = useInventoryDates();
  const dates = datesData?.dates ?? [];
  const latestDate = selectedDate || dates[0] || undefined;

  const { data: inventoryData, loading: invLoading, error: invError, refetch } = useInventory({
    snapshot_date: latestDate,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    page_size: 200,
  });

  const { data: branchData, loading: branchLoading } = useBranchSummary({
    snapshot_date: latestDate,
  });

  const { data: categoryData } = useCategoryBreakdown({
    snapshot_date: latestDate,
  });

  // ── Derived data ──────────────────────────────────────────────────────
  const items = inventoryData?.items ?? [];
  const totals = inventoryData?.totals;
  const branches = branchData?.branches ?? [];
  const categories = categoryData?.categories ?? [];

  // Compute per-branch stats from inventory items
  const totalQty = totals?.grand_total_qty ?? 0;
  const totalValue = totals?.grand_total_value ?? 0;

  // Low stock items: qty on any branch < 10% of total qty for that product
  const lowStockItems = items.filter(item => item.total_qty < 5 && item.total_qty > 0);
  const outOfStockItems = items.filter(item => item.total_qty === 0);

  // Category pie data
  const categoryPieData = categories.slice(0, 8).map((c, i) => ({
    name: c.category || 'Uncategorized',
    value: c.total_value,
    qty: c.total_qty,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  // Branch bar data
  const branchBarData = branches.map((b, i) => ({
    name: b.branch,
    qty: b.total_qty,
    value: b.total_value,
    fill: BRANCH_COLORS[i % BRANCH_COLORS.length],
  }));

  // Table columns
  const columns = [
    {
      key: 'product_code',
      label: 'Code',
      render: (row: InventoryItem) => (
        <span className="font-mono text-xs text-muted-foreground">{row.product_code}</span>
      ),
    },
    {
      key: 'product_name',
      label: 'Product',
      render: (row: InventoryItem) => (
        <div>
          <p className="font-medium text-sm">{row.product_name}</p>
          {row.category && (
            <p className="text-xs text-muted-foreground">{row.category}</p>
          )}
        </div>
      ),
    },
    {
      key: 'total_qty',
      label: 'Total Qty',
      render: (row: InventoryItem) => (
        <span className="font-semibold">{formatNumber(row.total_qty)}</span>
      ),
    },
    {
      key: 'total_value',
      label: 'Total Value',
      render: (row: InventoryItem) => (
        <span className="font-semibold text-indigo-600">{formatCurrency(row.total_value)}</span>
      ),
    },
    {
      key: 'cost_price',
      label: 'Cost Price',
      render: (row: InventoryItem) => formatCurrency(row.cost_price),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: InventoryItem) => (
        <StockStatusBadge qty={row.total_qty} total={row.total_qty > 0 ? row.total_qty : 1} />
      ),
    },
    // Per-branch quantities
    ...BRANCH_KEYS.map(b => ({
      key: b.key as string,
      label: b.label,
      render: (row: InventoryItem) => {
        const val = row[b.key] as number;
        return (
          <span className={val === 0 ? 'text-muted-foreground' : 'font-medium'}>
            {formatNumber(val)}
          </span>
        );
      },
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Multi-Branch Inventory</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage inventory across all branches
            {latestDate && (
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                Snapshot: {latestDate}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={invLoading}>
          {invLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter inventory data by date snapshot and category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Snapshot Date</label>
              <Select
                value={selectedDate || (dates[0] ?? '')}
                onValueChange={setSelectedDate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Latest snapshot" />
                </SelectTrigger>
                <SelectContent>
                  {dates.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invLoading ? '…' : formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {branches.length} branches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invLoading ? '…' : formatNumber(inventoryData?.count ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Active product lines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invLoading ? '…' : formatNumber(totalQty)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total quantity in stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{invLoading ? '…' : lowStockItems.length + outOfStockItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {outOfStockItems.length} out of stock · {lowStockItems.length} low
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Branch Cards */}
      {!branchLoading && branches.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch, i) => {
            const pct = totalValue > 0 ? (branch.total_value / totalValue) * 100 : 0;
            return (
              <Card key={branch.branch}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
                    />
                    {branch.branch}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Stock Value</p>
                      <p className="text-lg font-bold">{formatCurrency(branch.total_value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Qty</p>
                      <p className="text-lg font-bold">{formatNumber(branch.total_qty)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">% of total stock</span>
                      <span className="text-xs font-medium">{pct.toFixed(1)}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Branch bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Value by Branch</CardTitle>
            <CardDescription>Distribution of inventory value across branches</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={branchBarData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tickFormatter={v => formatCurrency(v).replace('$', '')} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="value" name="Stock Value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stock by Category</CardTitle>
            <CardDescription>Value breakdown by product category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Inventory Details</CardTitle>
              <CardDescription>
                Complete inventory across all branches
                {latestDate && ` — Snapshot: ${latestDate}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invError ? (
            <div className="text-center py-12 text-red-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{invError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
                Retry
              </Button>
            </div>
          ) : invLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading inventory...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No inventory data found for the selected filters.</p>
            </div>
          ) : (
            <DataTable
              data={items}
              columns={columns}
              searchable
              exportable
              pageSize={15}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
