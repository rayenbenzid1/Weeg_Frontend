// src/app/components/CreditKPISection.tsx

import { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Users, TrendingDown, AlertCircle, Clock,
  RefreshCw, Loader2, ShieldAlert, CreditCard,
  BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight,
  DollarSign, Wallet, Receipt, AlertTriangle, UserCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../lib/api';
import { formatCurrency, formatNumber } from '../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreditKPIItem {
  value: number;
  label: string;
  unit: string;
  description: string;
  numerator?: number;
  denominator?: number;
  ca_credit?: number;
  ca_total?: number;
  overdue_amount?: number;
  total_receivables?: number;
  recovered_amount?: number;
  total_credit?: number;
}

interface RiskyCustomer {
  id: string;
  account: string;
  account_code: string;
  customer_name: string;
  total: number;
  current: number;
  overdue_total: number;
  risk_score: 'low' | 'medium' | 'high' | 'critical';
  overdue_percentage: number;
  dmp_days: number;
  buckets: Record<string, number>;
}

interface BucketItem {
  bucket: string;
  label: string;
  amount: number;
  percentage: number;
  midpoint_days: number;
}

interface CreditKPIData {
  report_date: string | null;
  kpis: {
    taux_clients_credit: CreditKPIItem;
    taux_credit_total:   CreditKPIItem;
    taux_impayes:        CreditKPIItem;
    dmp:                 CreditKPIItem;
    taux_recouvrement:   CreditKPIItem;
  };
  top5_risky_customers: RiskyCustomer[];
  bucket_distribution:  BucketItem[];
  summary: {
    total_customers:         number;  // 377 — ALL rows in imported Excel
    credit_customers:        number;  // 174 — rows with balance > 0
    grand_total_receivables: number;
    overdue_amount:          number;
    ca_credit:               number;
    ca_total:                number;
  };
}

// ── English overrides for KPI metadata ───────────────────────────────────────

const KPI_EN: Record<string, { label: string; description: string; unit: string }> = {
  taux_clients_credit: {
    label:       'Credit Customer Rate',
    description: 'Share of customers with an active credit balance',
    unit:        '%',
  },
  taux_credit_total: {
    label:       'Total Credit Rate',
    description: 'Share of revenue realized on credit terms',
    unit:        '%',
  },
  taux_impayes: {
    label:       'Overdue Rate',
    description: 'Overdue receivables as a percentage of total receivables',
    unit:        '%',
  },
  dmp: {
    label:       'DSO (Avg. Payment Days)',
    description: 'Average number of days customers take to pay',
    unit:        'days',
  },
  taux_recouvrement: {
    label:       'Collection Rate',
    description: 'Percentage of credit sales successfully collected',
    unit:        '%',
  },
};

function normalizeBucketLabel(raw: string): string {
  return raw
    .replace(/\s*يوم/g, 'd')
    .replace(/\s*[Jj](?=\b|$)/g, 'd')
    .replace(/أكثر من\s*/i, '>')
    .trim();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<string, { label: string; bg: string; dot: string }> = {
  low:      { label: 'Low',      bg: 'bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300',  dot: 'bg-green-500'  },
  medium:   { label: 'Medium',   bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300', dot: 'bg-yellow-500' },
  high:     { label: 'High',     bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', dot: 'bg-orange-500' },
  critical: { label: 'Critical', bg: 'bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300',    dot: 'bg-red-500'    },
};

const BUCKET_COLORS = [
  '#10b981','#34d399','#fbbf24','#f59e0b',
  '#f97316','#ef4444','#dc2626','#b91c1c',
  '#991b1b','#7f1d1d','#6b21a8','#581c87','#3b0764',
];

// ── Summary ribbon card ───────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon: Icon, iconColor, iconBg,
}: {
  label: string; value: string; sub?: string;
  icon: LucideIcon; iconColor: string; iconBg: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">
            {label}
          </p>
          <p className="text-sm font-bold truncate mt-0.5">{value}</p>
          {sub && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── KPI Metric Card ───────────────────────────────────────────────────────────

function KPIMetricCard({
  kpi, kpiKey, icon: Icon, accentColor, accentBg, isGood, subline,
}: {
  kpi: CreditKPIItem;
  kpiKey: string;
  icon: LucideIcon;
  accentColor: string;
  accentBg: string;
  isGood?: (v: number) => boolean;
  subline?: React.ReactNode;
}) {
  const en         = KPI_EN[kpiKey] ?? { label: kpi.label, description: kpi.description, unit: kpi.unit };
  const good       = isGood ? isGood(kpi.value) : true;
  const TrendIcon  = good ? ArrowUpRight : ArrowDownRight;
  const trendCls   = good ? 'text-green-600 bg-green-50 dark:bg-green-950/40' : 'text-red-500 bg-red-50 dark:bg-red-950/40';
  const displayVal = en.unit === 'days' ? kpi.value.toFixed(0) : kpi.value.toFixed(1);

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${accentBg}`}>
              <Icon className={`w-4 h-4 ${accentColor}`} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight max-w-[140px]">
              {en.label}
            </p>
          </div>
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${trendCls}`}>
            <TrendIcon className="w-3 h-3" />
            {good ? 'Good' : 'Alert'}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-3xl font-extrabold tabular-nums tracking-tight">{displayVal}</span>
          <span className={`text-base font-semibold ${accentColor}`}>{en.unit}</span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {en.description}
        </p>

        {subline && (
          <div className="pt-3 border-t border-dashed">{subline}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({
  loading = false, onRefresh, reportDate,
}: {
  loading?: boolean; onRefresh: () => void; reportDate?: string | null;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-600" />
          Customer &amp; Credit KPIs
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Credit risk analysis and customer payment behavior
          {reportDate && (
            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
              Report: {reportDate}
            </span>
          )}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <RefreshCw className="h-4 w-4 mr-2" />}
        Refresh
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CreditKPISection() {
  const [data, setData]       = useState<CreditKPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CreditKPIData>('/kpi/credit/');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load credit KPIs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader loading onRefresh={fetchData} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="h-36 animate-pulse bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <SectionHeader onRefresh={fetchData} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive font-medium">{error || 'No data available'}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { kpis, top5_risky_customers, bucket_distribution, summary } = data;

  const chartData = [...bucket_distribution]
    .sort((a, b) => (a.midpoint_days ?? 0) - (b.midpoint_days ?? 0))
    .map((b, i) => ({
      name:       normalizeBucketLabel(b.label),
      amount:     b.amount,
      percentage: b.percentage,
      fill:       BUCKET_COLORS[i % BUCKET_COLORS.length],
    }))
    .filter(b => b.amount > 0);

  // ── Summary ribbon ────────────────────────────────────────────────────────
  //
  // CARD 1 — Total Accounts : 377
  //   = ALL rows in the imported Excel file (including balance = 0)
  //   Dynamic: changes every time a new Excel is imported.
  //
  // CARD 2 — Active Clients : 174
  //   = Rows with balance > 0 in this report
  //   Dynamic: changes every time a new Excel is imported.
  //
  const pctActive = summary.total_customers > 0
    ? ((summary.credit_customers / summary.total_customers) * 100).toFixed(1)
    : '0';

  const summaryCards: {
    label: string; value: string; sub?: string;
    icon: LucideIcon; iconColor: string; iconBg: string;
  }[] = [
    {
      // 377 — ALL accounts in this Excel import
      label:     'Total Accounts',
      value:     formatNumber(summary.total_customers),
      sub:       'All accounts in imported file',
      icon:      Users,
      iconColor: 'text-indigo-600',
      iconBg:    'bg-indigo-50 dark:bg-indigo-950/40',
    },
    {
      // 174 — accounts with balance > 0
      label:     'Active Clients',
      value:     formatNumber(summary.credit_customers),
      sub:       `${pctActive}% of total · balance > 0`,
      icon:      UserCheck,
      iconColor: 'text-emerald-600',
      iconBg:    'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label:     'Total Receivables',
      value:     formatCurrency(summary.grand_total_receivables),
      icon:      BarChart3,
      iconColor: 'text-blue-600',
      iconBg:    'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label:     'Overdue >60d',
      value:     formatCurrency(summary.overdue_amount),
      icon:      AlertTriangle,
      iconColor: 'text-amber-600',
      iconBg:    'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      label:     'Credit Revenue',
      value:     formatCurrency(summary.ca_credit),
      icon:      TrendingUp,
      iconColor: 'text-emerald-600',
      iconBg:    'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label:     'Total Revenue',
      value:     formatCurrency(summary.ca_total),
      icon:      DollarSign,
      iconColor: 'text-orange-600',
      iconBg:    'bg-orange-50 dark:bg-orange-950/40',
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader onRefresh={fetchData} reportDate={data.report_date} />

      {/* ── Summary ribbon ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card, i) => (
          <SummaryCard key={i} {...card} />
        ))}
      </div>

      {/* ── 5 KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        <KPIMetricCard
          kpi={kpis.taux_clients_credit}
          kpiKey="taux_clients_credit"
          icon={Users}
          accentColor="text-indigo-600"
          accentBg="bg-indigo-50 dark:bg-indigo-950/40"
          isGood={v => v >= 50}
          subline={
            // "174 active of 377 total accounts"
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-emerald-600">
                {formatNumber(summary.credit_customers)}
              </span>
              {' '}active of{' '}
              <span className="font-semibold text-foreground">
                {formatNumber(summary.total_customers)}
              </span>
              {' '}total accounts
            </p>
          }
        />

        <KPIMetricCard
          kpi={kpis.taux_credit_total}
          kpiKey="taux_credit_total"
          icon={CreditCard}
          accentColor="text-violet-600"
          accentBg="bg-violet-50 dark:bg-violet-950/40"
          isGood={v => v <= 85}
          subline={
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-violet-600">{formatCurrency(kpis.taux_credit_total.ca_credit ?? 0)}</span>
              {' '}<span className="text-muted-foreground/60">of</span>{' '}
              <span className="font-semibold text-foreground">{formatCurrency(kpis.taux_credit_total.ca_total ?? 0)}</span>
            </p>
          }
        />

        <KPIMetricCard
          kpi={kpis.taux_impayes}
          kpiKey="taux_impayes"
          icon={TrendingDown}
          accentColor="text-red-600"
          accentBg="bg-red-50 dark:bg-red-950/40"
          isGood={v => v <= 20}
          subline={
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-red-600">{formatCurrency(kpis.taux_impayes.overdue_amount ?? 0)}</span>
              {' '}<span className="text-muted-foreground/60">of</span>{' '}
              <span className="font-semibold text-foreground">{formatCurrency(kpis.taux_impayes.total_receivables ?? 0)}</span>
            </p>
          }
        />

        <KPIMetricCard
          kpi={kpis.dmp}
          kpiKey="dmp"
          icon={Clock}
          accentColor="text-amber-600"
          accentBg="bg-amber-50 dark:bg-amber-950/40"
          isGood={v => v <= 90}
          subline={
            <div className="flex items-center gap-2">
              {[
                { range: '< 30d',  color: 'text-green-600', match: kpis.dmp.value < 30                          },
                { range: '30–90d', color: 'text-amber-600', match: kpis.dmp.value >= 30 && kpis.dmp.value <= 90 },
                { range: '> 90d',  color: 'text-red-600',   match: kpis.dmp.value > 90                           },
              ].map(s => (
                <span
                  key={s.range}
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded
                    ${s.match
                      ? `${s.color} bg-current/10 ring-1 ring-current/30`
                      : 'text-muted-foreground'}`}
                >
                  {s.range}
                </span>
              ))}
            </div>
          }
        />

        <KPIMetricCard
          kpi={kpis.taux_recouvrement}
          kpiKey="taux_recouvrement"
          icon={BarChart3}
          accentColor="text-emerald-600"
          accentBg="bg-emerald-50 dark:bg-emerald-950/40"
          isGood={v => v >= 70}
          subline={
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-emerald-600">{formatCurrency(kpis.taux_recouvrement.recovered_amount ?? 0)}</span>
              {' '}<span className="text-muted-foreground/60">recovered of</span>{' '}
              <span className="font-semibold text-foreground">{formatCurrency(kpis.taux_recouvrement.total_credit ?? 0)}</span>
            </p>
          }
        />

        {/* Reference thresholds card */}
        <Card className="bg-slate-50 dark:bg-slate-800/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700">
                <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Reference Thresholds
              </p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Total credit rate', threshold: '< 85%',  color: 'bg-violet-500'  },
                { label: 'Overdue rate',       threshold: '< 20%',  color: 'bg-red-500'     },
                { label: 'DSO',                threshold: '< 30d',  color: 'bg-amber-500'   },
                { label: 'Collection rate',    threshold: '> 70%',  color: 'bg-emerald-500' },
              ].map(t => (
                <div key={t.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.color}`} />
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{t.threshold}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t">
              As of {data.report_date || 'latest'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Bucket Distribution Chart ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Receivables Breakdown by Age Bucket
          </CardTitle>
          <CardDescription>
            Amounts distributed by aging period (LYD) ·{' '}
            <span className="text-emerald-600 font-medium">
              {formatNumber(summary.credit_customers)} active
            </span>
            {' '}/ {formatNumber(summary.total_customers)} total accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const entry = payload[0];
                    const pct = (entry.payload as { percentage?: number })?.percentage;
                    return (
                      <div style={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: 12,
                      }}>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
                        <p>
                          Amount: <strong>{formatCurrency(entry.value as number)}</strong>
                          {pct != null ? ` (${pct.toFixed(1)}%)` : ''}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={chartData[i].fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Top 5 At-Risk Customers ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                Top 5 At-Risk Customers
              </CardTitle>
              <CardDescription>
                Customers with the highest receivables, ranked by risk level
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
                <span key={key} className={`flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${cfg.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {top5_risky_customers.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No at-risk customers found
            </div>
          ) : (
            <div className="space-y-3">
              {top5_risky_customers.map((customer, index) => {
                const cfg = RISK_CONFIG[customer.risk_score] ?? RISK_CONFIG.medium;
                return (
                  <div key={customer.id} className="p-4 rounded-xl border hover:bg-accent/30 transition-all duration-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm
                        ${index === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40'
                          : index === 1 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40'
                          : 'bg-muted text-muted-foreground'}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {customer.customer_name || customer.account_code}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">#{customer.account_code}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-red-600">{formatCurrency(customer.total)}</p>
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${cfg.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Current', value: formatCurrency(customer.current),       valueClass: 'text-green-600' },
                        { label: 'Overdue', value: formatCurrency(customer.overdue_total),  valueClass: 'text-red-600'   },
                        {
                          label: 'DSO',
                          value: `${customer.dmp_days.toFixed(0)} days`,
                          valueClass: customer.dmp_days > 90 ? 'text-red-600'
                            : customer.dmp_days > 30 ? 'text-amber-600'
                            : 'text-green-600',
                        },
                      ].map(stat => (
                        <div key={stat.label} className="p-2.5 rounded-lg bg-muted/40 text-center">
                          <p className="text-[10px] text-muted-foreground mb-0.5">{stat.label}</p>
                          <p className={`text-xs font-bold ${stat.valueClass}`}>{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t text-[11px] text-muted-foreground">
                      <span>Overdue: <span className="font-semibold text-red-500">{customer.overdue_percentage.toFixed(1)}%</span></span>
                      <span>Current: <span className="font-semibold text-green-600">{(100 - customer.overdue_percentage).toFixed(1)}%</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}