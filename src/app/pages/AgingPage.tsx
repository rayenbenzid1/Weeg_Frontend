// src/app/pages/AgingReceivablePage.tsx

import { useState, useMemo, useCallback } from 'react';
import {
  Search, RefreshCw, Loader2, AlertCircle, Download,
  ChevronUp, ChevronDown, ChevronsUpDown,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { useAgingReport, useAgingDates, type AgingRow } from '../lib/dataHooks';
import { formatCurrency } from '../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// FIX: Django DecimalField serializes as strings ("1234.56").
//      This function coerces every numeric bucket field to a real JS number.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeRow(r: AgingRow): AgingRow {
  const num = (v: unknown) => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };
  return {
    ...r,
    current:      num(r.current),
    d1_30:        num(r.d1_30),
    d31_60:       num(r.d31_60),
    d61_90:       num(r.d61_90),
    d91_120:      num(r.d91_120),
    d121_150:     num(r.d121_150),
    d151_180:     num(r.d151_180),
    d181_210:     num(r.d181_210),
    d211_240:     num(r.d211_240),
    d241_270:     num(r.d241_270),
    d271_300:     num(r.d271_300),
    d301_330:     num(r.d301_330),
    over_330:     num(r.over_330),
    total:        num(r.total),
    overdue_total: num(r.overdue_total),
    // fallback: use account string if customer_name is null
    customer_name: r.customer_name || r.account || null,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SortField = keyof Pick<AgingRow, 'customer_name' | 'total' | 'overdue_total' | 'risk_score' | 'current'>;
type SortDir   = 'asc' | 'desc';

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<string, {
  label: string; badgeClass: string; rowHighlight: string; color: string;
}> = {
  low:      { label: 'Low',      badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',    rowHighlight: '',                                                          color: '#10b981' },
  medium:   { label: 'Medium',   badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300', rowHighlight: '',                                                          color: '#f59e0b' },
  high:     { label: 'High',     badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', rowHighlight: 'border-l-2 border-orange-400',                              color: '#f97316' },
  critical: { label: 'Critical', badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',            rowHighlight: 'border-l-2 border-red-500 bg-red-50/30 dark:bg-red-950/20', color: '#ef4444' },
};

const BUCKETS: { key: keyof AgingRow; label: string }[] = [
  { key: 'current',  label: 'Current'  },
  { key: 'd1_30',    label: '1-30d'    },
  { key: 'd31_60',   label: '31-60d'   },
  { key: 'd61_90',   label: '61-90d'   },
  { key: 'd91_120',  label: '91-120d'  },
  { key: 'd121_150', label: '121-150d' },
  { key: 'd151_180', label: '151-180d' },
  { key: 'd181_210', label: '181-210d' },
  { key: 'd211_240', label: '211-240d' },
  { key: 'd241_270', label: '241-270d' },
  { key: 'd271_300', label: '271-300d' },
  { key: 'd301_330', label: '301-330d' },
  { key: 'over_330', label: '>330d'    },
];

const BUCKET_COLORS = [
  '#10b981','#34d399','#fbbf24','#f59e0b',
  '#f97316','#ef4444','#dc2626','#b91c1c',
  '#991b1b','#7f1d1d','#6b21a8','#581c87','#3b0764',
];

const PERIOD_OPTIONS = [
  { label: 'All Periods',    value: 'all'  },
  { label: 'Last 30 Days',   value: '30'   },
  { label: 'Last 90 Days',   value: '90'   },
  { label: 'Last 6 Months',  value: '180'  },
  { label: 'Last 12 Months', value: '365'  },
];

const PAGE_SIZE = 20;

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, iconBg, iconColor, sub }: {
  label: string; value: string; icon: React.ElementType;
  iconBg: string; iconColor: string; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{label}</p>
            <p className="text-xl font-bold truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortTh({ label, field, sort, onSort }: {
  label: string; field: SortField;
  sort: { field: SortField; dir: SortDir };
  onSort: (f: SortField) => void;
}) {
  const active = sort.field === field;
  const Icon   = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label} <Icon className={`h-3 w-3 ${active ? 'text-indigo-600' : ''}`} />
      </span>
    </th>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgingReceivablePage() {
  const { data: datesData }         = useAgingDates();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [period, setPeriod]         = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [search, setSearch]         = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [sort, setSort]             = useState<{ field: SortField; dir: SortDir }>({ field: 'total', dir: 'desc' });
  const [page, setPage]             = useState(1);

  const reportDate = selectedDate || datesData?.dates?.[0] || '';

  const { data: agingData, loading, error, refetch } = useAgingReport({
    report_date: reportDate || undefined,
    limit: 500,
  });

  // ── Normalize numeric fields (Django returns DecimalField as strings) ──────
  const rows: AgingRow[] = useMemo(
    () => (agingData?.results ?? []).filter(r => Number(r.total) > 0).map(normalizeRow),
    [agingData],
  );

  // total_accounts = ALL accounts in DB for this company (e.g. 377)
  // Provided by the updated AgingListView backend as agingData.total_accounts
  const totalAccounts: number = (agingData as any)?.total_accounts ?? 0;

  // ── Derive branch list ────────────────────────────────────────────────────
  const branches = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.account_code) set.add(r.account_code.slice(0, 4)); });
    return Array.from(set).sort();
  }, [rows]);

  // ── Aggregates ────────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    total:   rows.reduce((s, r) => s + r.total,         0),
    overdue: rows.reduce((s, r) => s + r.overdue_total, 0),
    current: rows.reduce((s, r) => s + r.current,       0),
  }), [rows]);

  const riskCounts = useMemo(() => {
    const c: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    rows.forEach(r => { c[r.risk_score] = (c[r.risk_score] ?? 0) + 1; });
    return c;
  }, [rows]);

  const bucketTotals = useMemo(() =>
    BUCKETS.map((b, i) => ({
      label:  b.label,
      amount: rows.reduce((s, r) => s + ((r[b.key] as number) || 0), 0),
      color:  BUCKET_COLORS[i],
    })).filter(b => b.amount > 0),
  [rows]);

  const pieData = useMemo(() =>
    Object.entries(riskCounts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: RISK_CONFIG[k].label, value: v, color: RISK_CONFIG[k].color })),
  [riskCounts]);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...rows];

    if (period !== 'all') {
      data = data.filter(r => r.total > 0);
    }

    if (branchFilter !== 'all') {
      data = data.filter(r => r.account_code.startsWith(branchFilter));
    }

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        r.account_code.toLowerCase().includes(q) ||
        (r.account ?? '').toLowerCase().includes(q)
      );
    }

    if (riskFilter !== 'all') {
      data = data.filter(r => r.risk_score === riskFilter);
    }

    data.sort((a, b) => {
      const av = a[sort.field] as string | number | null;
      const bv = b[sort.field] as string | number | null;
      if (typeof av === 'string' && typeof bv === 'string')
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc'
        ? ((av as number) ?? 0) - ((bv as number) ?? 0)
        : ((bv as number) ?? 0) - ((av as number) ?? 0);
    });
    return data;
  }, [rows, period, branchFilter, search, riskFilter, sort]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged     = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = useCallback((field: SortField) => {
    setSort(s => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  }, []);

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Code', 'Customer', ...BUCKETS.map(b => b.label), 'Total', 'Overdue', 'Risk'];
    const csvRows = filtered.map(r => [
      r.account_code,
      `"${(r.customer_name ?? r.account ?? '').replace(/"/g, '""')}"`,
      ...BUCKETS.map(b => ((r[b.key] as number) || 0).toFixed(2)),
      r.total.toFixed(2),
      r.overdue_total.toFixed(2),
      RISK_CONFIG[r.risk_score]?.label ?? r.risk_score,
    ].join(','));
    const csv  = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `aging_receivables_${reportDate || 'latest'}.csv`,
    });
    a.click();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Accounts Receivable Aging</h1>
          <p className="text-muted-foreground mt-1">
            Receivables breakdown by age bucket and customer risk assessment
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(datesData?.dates?.length ?? 0) > 1 && (
            <Select value={selectedDate} onValueChange={v => { setSelectedDate(v); setPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Latest report" />
              </SelectTrigger>
              <SelectContent>
                {datesData!.dates.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Filters panel ────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-semibold text-sm">Filters</p>
              <p className="text-xs text-muted-foreground">Customize your receivables view</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Period */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Period
              </label>
              <Select value={period} onValueChange={v => { setPeriod(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Periods" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Report Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Report Date
              </label>
              <Select
                value={selectedDate || '__latest__'}
                onValueChange={v => { setSelectedDate(v === '__latest__' ? '' : v); setPage(1); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Latest available" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__latest__">Latest available</SelectItem>
                  {(datesData?.dates ?? []).map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Risk Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Risk Level
              </label>
              <Select value={riskFilter} onValueChange={v => { setRiskFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Risk Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
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

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted/30" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          {rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 gap-3">
                <AlertCircle className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">No aging data available</p>
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Retry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Summary Stats ─────────────────────────────────────────── */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

                {/* CARD 1: Total Receivables — shows both 174 active and 377 total */}
                <StatCard
                  label="Total Receivables"
                  value={formatCurrency(totals.total)}
                  icon={TrendingUp}
                  iconBg="bg-indigo-100 dark:bg-indigo-900/40"
                  iconColor="text-indigo-600"
                  sub={
                    totalAccounts > 0
                      ? `${rows.length} active · ${totalAccounts} total accounts`
                      : `${rows.length} customers with open balance`
                  }
                />

                <StatCard
                  label="Current (not due)"
                  value={formatCurrency(totals.current)}
                  icon={CheckCircle2}
                  iconBg="bg-green-100 dark:bg-green-900/40"
                  iconColor="text-green-600"
                  sub={totals.total > 0
                    ? `${((totals.current / totals.total) * 100).toFixed(1)}% of total`
                    : undefined}
                />

                <StatCard
                  label="Overdue (>60d)"
                  value={formatCurrency(totals.overdue)}
                  icon={AlertTriangle}
                  iconBg="bg-red-100 dark:bg-red-900/40"
                  iconColor="text-red-600"
                  sub={totals.total > 0
                    ? `${((totals.overdue / totals.total) * 100).toFixed(1)}% of total`
                    : undefined}
                />

                <StatCard
                  label="At-Risk Customers"
                  value={`${(riskCounts.high ?? 0) + (riskCounts.critical ?? 0)}`}
                  icon={Clock}
                  iconBg="bg-orange-100 dark:bg-orange-900/40"
                  iconColor="text-orange-600"
                  sub={`${riskCounts.critical ?? 0} critical · ${riskCounts.high ?? 0} high`}
                />
              </div>

              {/* ── Charts ───────────────────────────────────────────────── */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Bucket distribution bar chart */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Receivables by Age Bucket</CardTitle>
                    <CardDescription>Aggregated amounts (LYD)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {bucketTotals.length === 0 ? (
                      <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
                        No data to display
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={bucketTotals} margin={{ left: 5, right: 5, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            formatter={(v: number) => [formatCurrency(v), 'Amount']}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {bucketTotals.map((_, i) => (
                              <Cell key={i} fill={bucketTotals[i].color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Risk distribution pie */}
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Distribution</CardTitle>
                    <CardDescription>
                      {rows.length} active
                      {totalAccounts > 0 && (
                        <span className="text-muted-foreground/70"> of {totalAccounts} total accounts</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={pieData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" outerRadius={85}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v} customers`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* ── Customer Detail Table ─────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle>Customer Detail</CardTitle>
                      <CardDescription>
                        {/* Shows: "174 active of 377 total accounts · page 1/9 · Report: 2026-02-26" */}
                        {filtered.length} active
                        {totalAccounts > 0 && (
                          <span className="text-muted-foreground/70"> of {totalAccounts} total accounts</span>
                        )}
                        {' '}· page {page}/{Math.max(pageCount, 1)}
                        {reportDate && (
                          <span className="ml-2 text-indigo-600">· Report: {reportDate}</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search customer or code…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b">
                        <tr>
                          <SortTh label="Customer"  field="customer_name" sort={sort} onSort={handleSort} />
                          <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Code</th>
                          {BUCKETS.map((b, i) => (
                            i === 0
                              ? <SortTh key={b.key} label={b.label} field="current" sort={sort} onSort={handleSort} />
                              : <th key={b.key} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{b.label}</th>
                          ))}
                          <SortTh label="Total"   field="total"         sort={sort} onSort={handleSort} />
                          <SortTh label="Overdue" field="overdue_total" sort={sort} onSort={handleSort} />
                          <SortTh label="Risk"    field="risk_score"    sort={sort} onSort={handleSort} />
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {paged.length === 0 ? (
                          <tr>
                            <td colSpan={18} className="text-center py-12 text-muted-foreground text-sm">
                              No results found
                            </td>
                          </tr>
                        ) : paged.map(row => {
                          const cfg = RISK_CONFIG[row.risk_score] ?? RISK_CONFIG.low;
                          return (
                            <tr key={row.id} className={`hover:bg-accent/30 transition-colors ${cfg.rowHighlight}`}>
                              <td className="px-3 py-2.5 font-medium max-w-[200px]">
                                <span className="truncate block" title={row.customer_name ?? row.account ?? ''}>
                                  {row.customer_name || row.account || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
                                {row.account_code}
                              </td>
                              {BUCKETS.map((b, i) => {
                                const val       = (row[b.key] as number) || 0;
                                const isOverdue = i >= 3; // d61_90 onwards
                                return (
                                  <td key={b.key}
                                    className={`px-3 py-2.5 whitespace-nowrap text-xs text-right
                                      ${val > 0 && isOverdue
                                        ? 'text-red-600 dark:text-red-400 font-medium'
                                        : val > 0 && i > 0
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : val > 0
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-muted-foreground/30'}`}
                                  >
                                    {val > 0 ? formatCurrency(val) : '—'}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">
                                {formatCurrency(row.total)}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap
                                ${row.overdue_total > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/40'}`}>
                                {row.overdue_total > 0 ? formatCurrency(row.overdue_total) : '—'}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}>
                                  {cfg.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* Totals footer */}
                      <tfoot className="bg-muted/40 border-t font-semibold text-xs">
                        <tr>
                          <td className="px-3 py-2.5" colSpan={2}>
                            {/* "Active: 174 / 377 total accounts" */}
                            Active: {filtered.length}
                            {totalAccounts > 0 && (
                              <span className="font-normal text-muted-foreground">
                                {' '}/ {totalAccounts} total accounts
                              </span>
                            )}
                          </td>
                          {BUCKETS.map(b => {
                            const s = filtered.reduce((acc, r) => acc + ((r[b.key] as number) || 0), 0);
                            return (
                              <td key={b.key} className="px-3 py-2.5 text-right whitespace-nowrap">
                                {s > 0 ? formatCurrency(s) : '—'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            {formatCurrency(filtered.reduce((s, r) => s + r.total, 0))}
                          </td>
                          <td className="px-3 py-2.5 text-right text-red-600 whitespace-nowrap">
                            {formatCurrency(filtered.reduce((s, r) => s + r.overdue_total, 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pageCount > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} active
                        {totalAccounts > 0 && ` (${totalAccounts} total accounts)`}
                      </p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                          Previous
                        </Button>
                        {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                          const p = page <= 3 ? i + 1 : page + i - 2;
                          if (p < 1 || p > pageCount) return null;
                          return (
                            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                              onClick={() => setPage(p)} className="w-9">
                              {p}
                            </Button>
                          );
                        })}
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}