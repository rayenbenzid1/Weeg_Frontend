import {
  DollarSign, ShoppingCart, Package, TrendingUp,
  AlertTriangle, BarChart3, Wallet, Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { KPICard } from '../components/KPICard';
import { ChartCard } from '../components/ChartCard';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  useKPIs,
  useTransactionSummary,
  useAgingDistribution,
  useAgingRisk,
  useBranchSummary,
  useBranchBreakdown,
  useCategoryBreakdown,
} from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────

const AGING_COLORS: Record<string, string> = {
  current: '#10b981',
  d1_30: '#34d399',
  d31_60: '#f59e0b',
  d61_90: '#f97316',
  d91_120: '#ef4444',
  d121_150: '#dc2626',
  d151_180: '#b91c1c',
  d181_210: '#991b1b',
  d211_240: '#7f1d1d',
  d241_270: '#78350f',
  d271_300: '#92400e',
  d301_330: '#6b21a8',
  over_330: '#4c1d95',
};

const BRANCH_COLORS = ['#4f46e5', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-24 text-destructive text-sm">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export function DashboardPage() {
  const [selectedBranch, setSelectedBranch] = useState('all');

  // ── Data hooks ────────────────────────────────────────────────────────────
  const kpi = useKPIs();
  const summary = useTransactionSummary();
  const agingDist = useAgingDistribution();
  const agingRisk = useAgingRisk({ limit: 5 });
  const branchStockSummary = useBranchSummary();
  const branchSales = useBranchBreakdown({ movement_type: 'sale' });
  const categoryBreakdown = useCategoryBreakdown();

  // ── KPI derived values ─────────────────────────────────────────────────
  const kpiData = kpi.data;
  const monthlySales = summary.data?.summary ?? [];

  // Chart: last 12 months for trend line
  const trendChartData = [...monthlySales]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-12)
    .map(m => ({
      month: `${m.month_label} ${m.year}`,
      sales: m.total_sales,
      purchases: m.total_purchases,
    }));

  // Chart: aging distribution — filter non-zero buckets for pie
  const agingPieData = (agingDist.data?.distribution ?? [])
    .filter(b => b.total > 0)
    .map(b => ({ name: b.label, value: b.total, fill: AGING_COLORS[b.bucket] ?? '#6b7280' }));

  // Chart: branch performance
  const branchStockMap = Object.fromEntries(
    (branchStockSummary.data?.branches ?? []).map(b => [b.branch, b.total_value])
  );
  const branchPerfData = (branchSales.data?.branches ?? []).map(b => ({
    branch: b.branch,
    sales: b.total,
    stock: branchStockMap[b.branch] ?? 0,
  }));

  // Chart: category breakdown
  const categoryData = (categoryBreakdown.data?.categories ?? []).slice(0, 8).map((c, i) => ({
    category: c.category,
    value: c.total_value,
    fill: BRANCH_COLORS[i % BRANCH_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your business performance and key metrics
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize your dashboard view</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Branch</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {(branchStockSummary.data?.branches ?? []).map(b => (
                    <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {kpi.loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-32" />
          ))}
        </div>
      ) : kpi.error ? (
        <ErrorState message={kpi.error} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Sales"
            value={formatCurrency(kpiData?.totalSalesValue ?? 0)}
            icon={TrendingUp}
          />
          <KPICard
            title="Total Purchases"
            value={formatCurrency(kpiData?.totalPurchasesValue ?? 0)}
            icon={DollarSign}
          />
          <KPICard
            title="Current Stock Value"
            value={formatCurrency(kpiData?.stockValue ?? 0)}
            icon={Package}
          />
          <KPICard
            title="Total Receivables"
            value={formatCurrency(kpiData?.totalReceivables ?? 0)}
            icon={Wallet}
          />
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales vs Purchases monthly trend */}
        <ChartCard
          title="Sales vs Purchases"
          description="Monthly comparison over the last 12 months"
        >
          {summary.loading ? (
            <LoadingState label="Loading trend data…" />
          ) : trendChartData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No transaction data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={2} name="Sales" dot={false} />
                <Line type="monotone" dataKey="purchases" stroke="#f59e0b" strokeWidth={2} name="Purchases" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Branch performance */}
        <ChartCard
          title="Branch Performance"
          description="Sales vs stock value comparison per branch"
        >
          {branchSales.loading || branchStockSummary.loading ? (
            <LoadingState label="Loading branch data…" />
          ) : branchPerfData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No branch data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={branchPerfData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="branch" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="sales" fill="#4f46e5" name="Sales" />
                <Bar dataKey="stock" fill="#8b5cf6" name="Stock Value" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Aging receivables distribution */}
        <ChartCard
          title="Aging Receivables Distribution"
          description="Breakdown of outstanding receivables by aging period"
        >
          {agingDist.loading ? (
            <LoadingState label="Loading aging data…" />
          ) : agingPieData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No aging data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={agingPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {agingPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Category breakdown */}
        <ChartCard
          title="Inventory by Category"
          description="Stock value distribution across product categories"
        >
          {categoryBreakdown.loading ? (
            <LoadingState label="Loading category data…" />
          ) : categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No category data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" className="text-xs" width={90} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="value" name="Stock Value">
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Top Risky Customers */}
      <ChartCard
        title="Top Risky Customers"
        description="Customers with highest overdue balances — requires immediate attention"
      >
        {agingRisk.loading ? (
          <LoadingState label="Loading risk data…" />
        ) : !agingRisk.data || agingRisk.data.top_risk.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No at-risk customers found
          </div>
        ) : (
          <div className="space-y-4">
            {agingRisk.data.top_risk.map((item) => {
              const overduePct = item.total > 0
                ? Math.min(100, (item.overdue_total / item.total) * 100)
                : 0;
              return (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {item.customer_name || item.account}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.account_code}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.overdue_total)}
                        </span>
                        <Badge
                          variant={
                            item.risk_score === 'critical' ? 'destructive'
                            : item.risk_score === 'high' ? 'destructive'
                            : 'secondary'
                          }
                          className="capitalize"
                        >
                          {item.risk_score}
                        </Badge>
                      </div>
                    </div>
                    <Progress
                      value={overduePct}
                      className="h-1.5"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>

      {/* Margin / Revenue trend */}
      <ChartCard
        title="Revenue Trend"
        description="Cumulative sales revenue over time"
      >
        {summary.loading ? (
          <LoadingState label="Loading revenue data…" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 10 }} />
              <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#colorSales)"
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
