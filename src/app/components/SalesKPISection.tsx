// src/app/components/SalesKPISection.tsx
import { useState } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, Clock,
  BarChart2, ArrowUp, ArrowDown, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useSalesKPI } from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
                '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiStatCard({
  label, value, sub, icon: Icon, iconBg, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  trend?: { value: number; isUp: boolean } | null;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${iconBg}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{label}</p>
            <p className="text-xl font-bold truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-sm font-semibold ${trend.isUp ? 'text-green-600' : 'text-red-500'}`}>
              {trend.isUp ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              {trend.value.toFixed(1)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────

export function SalesKPISection() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, loading, error, refetch } = useSalesKPI({ year });

  // Safe numeric fallbacks (API can return null)
  const caTotal = Number(data?.ca?.total ?? 0);
  const caPrevious = Number(data?.ca?.previous ?? 0);
  const salesEvolutionValue = Number(data?.sales_evolution?.value ?? 0);
  const hasSalesEvolution = data?.sales_evolution?.is_up !== null && data?.sales_evolution?.is_up !== undefined;
  const salesEvolutionIsUp = Boolean(data?.sales_evolution?.is_up);
  const salesEvolutionDescription = data?.sales_evolution?.description ?? 'No comparison data';

  // Build monthly trend chart data
  const monthlyChartData = [...(data?.monthly_sales ?? [])]
    .sort((a, b) => a.month - b.month)
    .map(m => ({ month: m.month_label, revenue: m.total_revenue, qty: m.total_qty }));

  const topProducts = data?.top_products.slice(0, 10) ?? [];
  const topClients  = data?.top_clients.slice(0, 8) ?? [];
  const margins     = data?.product_margins.filter(p => p.margin_pct !== undefined).slice(0, 10) ?? [];
  const velocity    = data?.sales_velocity;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Sales KPIs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue, top products, margins, top clients & sales velocity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="flex gap-1">
            {[currentYear - 1, currentYear].map(y => (
              <Button
                key={y}
                size="sm"
                variant={year === y ? 'default' : 'outline'}
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
            <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {loading && !error && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
          <span className="ml-3 text-muted-foreground">Loading sales KPIs…</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── KPI Summary cards ── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiStatCard
              label="Total Revenue (CA)"
              value={formatCurrency(caTotal)}
              sub={`vs ${formatCurrency(caPrevious)} prev. year`}
              icon={TrendingUp}
              iconBg="bg-indigo-600"
              trend={caPrevious > 0
                ? { value: Math.abs(salesEvolutionValue), isUp: salesEvolutionIsUp }
                : null}
            />
            <KpiStatCard
              label="Sales Evolution"
              value={hasSalesEvolution ? `${salesEvolutionIsUp ? '+' : ''}${salesEvolutionValue.toFixed(1)}%` : 'N/A'}
              sub={salesEvolutionDescription}
              icon={!hasSalesEvolution ? Clock : salesEvolutionIsUp ? TrendingUp : TrendingDown}
              iconBg={!hasSalesEvolution ? 'bg-slate-500' : salesEvolutionIsUp ? 'bg-green-600' : 'bg-red-500'}
            />
            <KpiStatCard
              label="Top Products"
              value={String(topProducts.length)}
              sub={topProducts[0] ? `#1: ${topProducts[0].material_name.slice(0, 24)}` : 'No data'}
              icon={ShoppingBag}
              iconBg="bg-violet-600"
            />
            <KpiStatCard
              label="Avg Daily Sales"
              value={formatCurrency(velocity?.avg_daily_revenue ?? 0)}
              sub={velocity ? `Over ${velocity.n_days} days · ${formatNumber(velocity.avg_daily_qty)} units/day` : ''}
              icon={Clock}
              iconBg="bg-amber-500"
            />
          </div>

          {/* ── Monthly revenue trend ── */}
          {monthlyChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue — {year}</CardTitle>
                <CardDescription>Revenue trend by month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlyChartData}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Area
                      type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2}
                      fill="url(#salesGrad)" name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Top Products + Top Clients ── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Top Products */}
            {topProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-indigo-600" />
                    Top Products by Revenue
                  </CardTitle>
                  <CardDescription>Top {topProducts.length} products · {year}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topProducts.map(p => ({
                        name: p.material_name.slice(0, 18),
                        revenue: p.total_revenue,
                        share: p.revenue_share,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                      <RechartsTooltip
                        formatter={(v: number, name: string) =>
                          name === 'revenue' ? [formatCurrency(v), 'Revenue'] : [`${v.toFixed(1)}%`, 'Share']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                        {topProducts.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Top Clients */}
            {topClients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    Top Clients by Revenue
                  </CardTitle>
                  <CardDescription>Excludes cash customers (نقدي / قطاعي)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topClients.map((client, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate" title={client.customer_name}>
                              {client.customer_name}
                            </p>
                            <span className="text-sm font-bold text-indigo-600 ml-2 shrink-0">
                              {formatCurrency(client.total_revenue)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={Number(client.revenue_share ?? 0)} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground w-10 text-right">
                              {Number(client.revenue_share ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {client.transaction_count} ops
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Product Margins ── */}
          {margins.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-amber-600" />
                  Product Margins
                </CardTitle>
                <CardDescription>
                  Gross margin % per product (estimated from purchase cost data)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {margins.map((p, i) => {
                    const margin = p.margin_pct ?? 0;
                    const color = margin >= 30 ? 'bg-green-500'
                                : margin >= 15 ? 'bg-amber-500'
                                : 'bg-red-500';
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <p className="text-sm font-medium truncate w-48 shrink-0" title={p.material_name}>
                          {p.material_name.slice(0, 28)}
                        </p>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${color}`}
                              style={{ width: `${Math.min(100, Math.max(0, margin))}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold w-14 text-right ${
                            margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground w-28 text-right shrink-0">
                          {formatCurrency(p.total_revenue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Sales Velocity by Product ── */}
          {(velocity?.by_product?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-violet-600" />
                  Sales Velocity — Days to Sell 100 Units
                </CardTitle>
                <CardDescription>
                  Faster products sell first · {velocity!.n_days} days period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground uppercase">
                        <th className="py-2 text-left font-semibold">Product</th>
                        <th className="py-2 text-right font-semibold">Avg Qty/Day</th>
                        <th className="py-2 text-right font-semibold">Avg Revenue/Day</th>
                        <th className="py-2 text-right font-semibold">Days to sell 100</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {velocity!.by_product.slice(0, 10).map((p, i) => (
                        <tr key={i} className="hover:bg-accent/30">
                          <td className="py-2 font-medium max-w-[220px] truncate" title={p.material_name}>
                            {p.material_name}
                          </td>
                          <td className="py-2 text-right">{p.avg_daily_qty.toFixed(2)}</td>
                          <td className="py-2 text-right">{formatCurrency(p.avg_daily_revenue)}</td>
                          <td className="py-2 text-right">
                            <Badge variant={p.days_to_sell_100 <= 30 ? 'default' : p.days_to_sell_100 <= 90 ? 'secondary' : 'outline'}>
                              {p.days_to_sell_100 > 9999 ? '∞' : `${p.days_to_sell_100}d`}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}