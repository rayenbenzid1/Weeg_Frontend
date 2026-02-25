import { useState } from 'react';
import { TrendingUp, Package, DollarSign, BarChart3, Info, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  useKPIs,
  useTransactionSummary,
  useBranchBreakdown,
  useTypeBreakdown,
  useAgingRisk,
  useAgingDates,
  type MonthlySummaryItem,
} from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

const BRANCH_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function TooltipKPICard({
  title,
  value,
  trend,
  icon: Icon,
  tooltip,
  formula,
}: {
  title: string;
  value: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  icon: React.FC<any>;
  tooltip: string;
  formula: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <KPICard title={title} value={value} trend={trend} icon={Icon} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{tooltip}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{formula}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function KPIEnginePage() {
  const [selectedBranch, setSelectedBranch] = useState('all');

  // ── Data hooks ─────────────────────────────────────────────────────────
  const { data: kpis, loading: kpiLoading, refetch: refetchKPIs } = useKPIs();
  const { data: summaryRes, loading: summaryLoading } = useTransactionSummary();
  const { data: branchSalesRes } = useBranchBreakdown({ movement_type: 'sale' });
  const { data: branchPurchasesRes } = useBranchBreakdown({ movement_type: 'purchase' });
  const { data: typeBreakdownRes } = useTypeBreakdown();
  const { data: agingDatesData } = useAgingDates();
  const { data: agingRiskRes } = useAgingRisk({ limit: 5 });

  // ── Derived data ──────────────────────────────────────────────────────
  const monthlySummary: MonthlySummaryItem[] = summaryRes?.summary ?? [];

  // Build monthly chart data
  const monthlySalesData = [...monthlySummary]
    .sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month))
    .slice(-12)
    .map(m => ({
      month: m.month_label,
      sales: m.total_sales,
      purchases: m.total_purchases,
      margin: m.total_sales - m.total_purchases,
    }));

  // Branch performance
  const branchSales = branchSalesRes?.branches ?? [];
  const branchPurchases = branchPurchasesRes?.branches ?? [];
  const allBranches = Array.from(
    new Set([...branchSales.map(b => b.branch), ...branchPurchases.map(b => b.branch)])
  );
  const branchPerformanceData = allBranches.map((branch, i) => ({
    branch,
    sales: branchSales.find(b => b.branch === branch)?.total ?? 0,
    purchases: branchPurchases.find(b => b.branch === branch)?.total ?? 0,
    fill: BRANCH_COLORS[i % BRANCH_COLORS.length],
  }));

  // Movement type breakdown
  const typeData = (typeBreakdownRes?.breakdown ?? []).map(t => ({
    name: t.label,
    in: t.total_in,
    out: t.total_out,
    count: t.count,
  }));

  // KPI computations
  const totalSales = kpis?.totalSalesValue ?? 0;
  const totalPurchases = kpis?.totalPurchasesValue ?? 0;
  const stockValue = kpis?.stockValue ?? 0;
  const totalReceivables = kpis?.totalReceivables ?? 0;
  const grossMargin = totalSales > 0 ? ((totalSales - totalPurchases) / totalSales) * 100 : 0;

  // Month-over-month trend
  const lastTwo = monthlySummary.slice(-2);
  const salesTrend = lastTwo.length === 2 && lastTwo[0].total_sales > 0
    ? { value: Math.abs(((lastTwo[1].total_sales - lastTwo[0].total_sales) / lastTwo[0].total_sales) * 100), isPositive: lastTwo[1].total_sales >= lastTwo[0].total_sales }
    : undefined;

  // Top risky customers
  const topRisk = agingRiskRes?.top_risk ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">KPI Engine</h1>
          <p className="text-muted-foreground mt-1">
            Automated calculation and monitoring of key performance indicators
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchKPIs} disabled={kpiLoading}>
          {kpiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Loading state */}
      {kpiLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="ml-3 text-muted-foreground">Loading KPIs from backend...</span>
        </div>
      )}

      {/* Core KPIs */}
      {!kpiLoading && (
        <>
          <div>
            <h2 className="text-xl font-semibold mb-4">Business KPIs</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <TooltipKPICard
                title="Total Sales"
                value={formatCurrency(totalSales)}
                trend={salesTrend}
                icon={TrendingUp}
                tooltip="Total revenue from all sales movements"
                formula="SUM(movements.total_out WHERE type IN ['sale'])"
              />

              <TooltipKPICard
                title="Total Purchases"
                value={formatCurrency(totalPurchases)}
                icon={DollarSign}
                tooltip="Total cost from all purchase movements"
                formula="SUM(movements.total_in WHERE type IN ['purchase', 'main_entry'])"
              />

              <TooltipKPICard
                title="Stock Value"
                value={formatCurrency(stockValue)}
                icon={Package}
                tooltip="Current total inventory value across all branches"
                formula="SUM(inventory.total_value) @ latest snapshot"
              />

              <TooltipKPICard
                title="Total Receivables"
                value={formatCurrency(totalReceivables)}
                icon={BarChart3}
                tooltip="Total outstanding customer receivables from aging report"
                formula="SUM(aging.total) @ latest report date"
              />

              <TooltipKPICard
                title="Gross Margin"
                value={`${grossMargin.toFixed(1)}%`}
                trend={{ value: 0, isPositive: grossMargin > 0 }}
                icon={BarChart3}
                tooltip="Gross profit margin percentage over all recorded periods"
                formula="(Total Sales − Total Purchases) / Total Sales × 100"
              />

              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950">
                    <Info className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Sales / Stock Ratio</p>
                  <p className="text-2xl font-bold">
                    {stockValue > 0 ? (totalSales / stockValue).toFixed(2) : '—'}x
                  </p>
                  <p className="text-xs text-muted-foreground">Sales-to-inventory coverage</p>
                </div>
              </Card>
            </div>
          </div>

          {/* Monthly Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales vs Purchases — Monthly Trend</CardTitle>
              <CardDescription>12-month comparison with margin evolution</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="flex items-center justify-center h-[320px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : monthlySalesData.length === 0 ? (
                <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                  No transaction data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={monthlySalesData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={2} fill="url(#colorSales)" name="Sales" />
                    <Area type="monotone" dataKey="purchases" stroke="#f59e0b" strokeWidth={2} fill="url(#colorPurchases)" name="Purchases" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Branch Performance */}
          {branchPerformanceData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Branch Performance</CardTitle>
                <CardDescription>Sales and purchases by branch</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={branchPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="branch" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar dataKey="sales" fill="#4f46e5" name="Sales" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="purchases" fill="#f59e0b" name="Purchases" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Movement Type Breakdown */}
          {typeData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Movement Type Breakdown</CardTitle>
                <CardDescription>Inventory movement activity by type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {typeData.map((t, i) => {
                    const maxVal = Math.max(...typeData.map(x => Math.max(x.in, x.out)));
                    const pct = maxVal > 0 ? ((t.in + t.out) / (maxVal * 2)) * 100 : 0;
                    return (
                      <div key={i} className="p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{t.name}</h4>
                            <p className="text-xs text-muted-foreground">{formatNumber(t.count)} operations</p>
                          </div>
                          <div className="text-right flex gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">In</p>
                              <p className="font-semibold text-green-600">{formatCurrency(t.in)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Out</p>
                              <p className="font-semibold text-red-600">{formatCurrency(t.out)}</p>
                            </div>
                          </div>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Risky Customers (from aging) */}
          {topRisk.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Risky Customers</CardTitle>
                <CardDescription>Customers with highest outstanding receivables risk</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topRisk.map((item, index) => {
                    const riskColors: Record<string, string> = {
                      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
                      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                    };
                    const riskPct: Record<string, number> = { critical: 90, high: 70, medium: 45, low: 20 };
                    const score = riskPct[item.risk_score] ?? 50;
                    return (
                      <div key={item.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 font-bold text-red-600 dark:text-red-400 shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="font-medium">{item.customer_name || item.account}</p>
                              <p className="text-xs text-muted-foreground font-mono">{item.account_code}</p>
                            </div>
                            <div className="text-right flex flex-col gap-1 items-end">
                              <p className="font-semibold text-red-600">{formatCurrency(item.total)}</p>
                              <Badge className={`text-xs ${riskColors[item.risk_score] ?? ''}`}>
                                {item.risk_score.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={score} className="flex-1 h-1.5 [&>div]:bg-red-500" />
                            <span className="text-xs text-muted-foreground w-10 text-right">
                              {score}/100
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
