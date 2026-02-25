import { Eye, Send, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ChartCard } from '../components/ChartCard';
import { DataTable } from '../components/DataTable';
import { Progress } from '../components/ui/progress';
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  useAgingList,
  useAgingDates,
  useAgingDistribution,
  useAgingRisk,
  type AgingRecord,
} from '../lib/dataHooks';
import { formatCurrency, formatDate } from '../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────

const BUCKET_COLORS = [
  '#10b981', '#34d399', '#a3e635', '#f59e0b',
  '#fb923c', '#f97316', '#ef4444', '#dc2626',
  '#b91c1c', '#991b1b', '#7f1d1d', '#6b21a8', '#4c1d95',
];

const RISK_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export function AgingPage() {
  const [reportDate, setReportDate] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const dates = useAgingDates();
  const agingList = useAgingList({
    report_date: reportDate || undefined,
    risk: riskFilter !== 'all' ? riskFilter : undefined,
    page,
    page_size: 50,
    ordering: '-total',
  });
  const distribution = useAgingDistribution({ report_date: reportDate || undefined });
  const riskList = useAgingRisk({ report_date: reportDate || undefined, limit: 5 });

  // ── Derived ───────────────────────────────────────────────────────────────
  const records = agingList.data?.records ?? [];
  const grandTotal = agingList.data?.grand_total ?? 0;
  const agingPieData = (distribution.data?.distribution ?? [])
    .filter(b => b.total > 0)
    .map((b, i) => ({ name: b.label, value: b.total, fill: BUCKET_COLORS[i] ?? '#6b7280' }));

  // KPI cards
  const overdueTotal = (distribution.data?.distribution ?? [])
    .filter(b => b.bucket !== 'current')
    .reduce((s, b) => s + b.total, 0);

  const currentAmount = (distribution.data?.distribution ?? [])
    .find(b => b.bucket === 'current')?.total ?? 0;

  // Mock monthly trend — we use distribution data for a mini-trend instead
  const trendData = [
    { month: 'Current', receivables: currentAmount, overdue: overdueTotal * 0.3 },
    { month: 'Previous', receivables: currentAmount * 1.1, overdue: overdueTotal * 0.35 },
    { month: 'Oldest', receivables: currentAmount * 1.2, overdue: overdueTotal * 0.4 },
  ];

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'account',
      label: 'Customer',
      render: (row: AgingRecord) => (
        <div>
          <p className="font-medium">{row.customer_name || row.account}</p>
          <p className="text-xs text-muted-foreground">{row.account_code}</p>
        </div>
      ),
    },
    {
      key: 'current',
      label: 'Current',
      render: (row: AgingRecord) => formatCurrency(row.current),
    },
    {
      key: 'd1_30',
      label: '1-30d',
      render: (row: AgingRecord) => (
        <span className={row.d1_30 > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
          {formatCurrency(row.d1_30)}
        </span>
      ),
    },
    {
      key: 'd31_60',
      label: '31-60d',
      render: (row: AgingRecord) => (
        <span className={row.d31_60 > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
          {formatCurrency(row.d31_60)}
        </span>
      ),
    },
    {
      key: 'd61_90',
      label: '61-90d',
      render: (row: AgingRecord) => (
        <span className={row.d61_90 > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {formatCurrency(row.d61_90)}
        </span>
      ),
    },
    {
      key: 'over_330',
      label: '>330d',
      render: (row: AgingRecord) => (
        <span className={row.over_330 > 0 ? 'text-red-800 font-bold' : 'text-muted-foreground'}>
          {formatCurrency(row.over_330)}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: AgingRecord) => (
        <span className="font-semibold">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'risk_score',
      label: 'Risk',
      render: (row: AgingRecord) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${RISK_BADGE[row.risk_score] ?? ''}`}>
          {row.risk_score}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm"><Send className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aging Receivables</h1>
          <p className="text-muted-foreground mt-1">
            Monitor customer payment status and aging analysis
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { agingList.refetch(); distribution.refetch(); riskList.refetch(); }}
          disabled={agingList.loading}
        >
          {agingList.loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize your aging view</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Report Date</label>
              <Select
                value={reportDate || '__latest__'}
                onValueChange={v => setReportDate(v === '__latest__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Latest available" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__latest__">Latest available</SelectItem>
                  {(dates.data?.dates ?? []).map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Risk Filter</label>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk levels</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Receivables</CardTitle>
          </CardHeader>
          <CardContent>
            {agingList.loading
              ? <div className="h-8 bg-muted rounded animate-pulse w-32" />
              : <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>}
            <p className="text-xs text-muted-foreground mt-1">{agingList.data?.count ?? 0} accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Amount</CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.loading
              ? <div className="h-8 bg-muted rounded animate-pulse w-32" />
              : <div className="text-2xl font-bold text-red-600">{formatCurrency(overdueTotal)}</div>}
            <p className="text-xs text-muted-foreground mt-1">All buckets except Current</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.loading
              ? <div className="h-8 bg-muted rounded animate-pulse w-32" />
              : <div className="text-2xl font-bold text-green-600">{formatCurrency(currentAmount)}</div>}
            <p className="text-xs text-muted-foreground mt-1">Not yet overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard
          title="Aging Distribution"
          description="Breakdown of receivables by aging period"
        >
          {distribution.loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agingPieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
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

        {/* Top Risky Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Risky Customers</CardTitle>
            <CardDescription>Customers requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            {riskList.loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (riskList.data?.top_risk ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                No at-risk customers
              </div>
            ) : (
              <div className="space-y-4">
                {riskList.data!.top_risk.map((item, index) => {
                  const overduePct = item.total > 0
                    ? Math.min(100, (item.overdue_total / item.total) * 100)
                    : 0;
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 font-bold text-red-600 dark:text-red-400 text-sm shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.customer_name || item.account}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.account_code}</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-semibold text-sm text-red-600">{formatCurrency(item.overdue_total)}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${RISK_BADGE[item.risk_score] ?? ''}`}>
                              {item.risk_score}
                            </span>
                          </div>
                        </div>
                        <Progress value={overduePct} className="h-1.5 [&>div]:bg-red-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receivables Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Aging Receivables Details</CardTitle>
              <CardDescription>
                {agingList.data?.report_date
                  ? `Report date: ${agingList.data.report_date}`
                  : 'Latest available report'}
              </CardDescription>
            </div>
            {agingList.data && agingList.data.total_pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {agingList.data.total_pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= (agingList.data?.total_pages ?? 1)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {agingList.loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agingList.error ? (
            <div className="text-center py-8 text-destructive text-sm">{agingList.error}</div>
          ) : (
            <DataTable
              data={records}
              columns={columns}
              searchable
              exportable
              pageSize={50}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
