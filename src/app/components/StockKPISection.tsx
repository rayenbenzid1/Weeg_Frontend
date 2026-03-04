// src/app/components/StockKPISection.tsx
import { useState } from 'react';
import {
  Package, RotateCcw, AlertTriangle, ShieldAlert, Calendar,
  Loader2, AlertCircle, RefreshCw, TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useStockKPI } from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

const ROTATION_COLORS = ['#10b981', '#34d399', '#a3e635', '#fbbf24', '#f97316'];

function StatCard({
  label, value, sub, icon: Icon, iconBg, iconColor,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
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

export function StockKPISection() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, loading, error, refetch } = useStockKPI({ year });

  const summary       = data?.stock_summary;
  const topRotation   = data?.top_rotation_products ?? [];
  const lowRotation   = data?.low_rotation_products ?? [];
  const zeroStock     = data?.zero_stock_products ?? [];
  const coverageAtRisk = data?.coverage_at_risk ?? [];

  const rotationChartData = topRotation.slice(0, 10).map(p => ({
    name: p.product_name.slice(0, 18),
    rotation: parseFloat(p.rotation_rate.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Stock KPIs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rotation rates, coverage, slow movers & stockouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[currentYear - 1, currentYear].map(y => (
              <Button key={y} size="sm" variant={year === y ? 'default' : 'outline'} onClick={() => setYear(y)}>
                {y}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

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
          <Loader2 className="h-7 w-7 animate-spin text-green-600" />
          <span className="ml-3 text-muted-foreground">Loading stock KPIs…</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Summary cards ── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Products"
              value={formatNumber(summary?.total_products ?? 0)}
              sub={`Total qty: ${formatNumber(summary?.total_qty ?? 0)}`}
              icon={Package}
              iconBg="bg-indigo-100 dark:bg-indigo-900/40"
              iconColor="text-indigo-600"
            />
            <StatCard
              label="Total Stock Value"
              value={formatCurrency(summary?.total_value ?? 0)}
              sub={data.snapshot_date ? `Snapshot: ${data.snapshot_date}` : undefined}
              icon={Package}
              iconBg="bg-green-100 dark:bg-green-900/40"
              iconColor="text-green-600"
            />
            <StatCard
              label="Zero Stock Products"
              value={String(summary?.zero_stock_count ?? 0)}
              sub="Out of stock — needs reorder"
              icon={AlertTriangle}
              iconBg="bg-red-100 dark:bg-red-900/40"
              iconColor="text-red-600"
            />
            <StatCard
              label="Low Rotation Products"
              value={String(summary?.low_rotation_count ?? 0)}
              sub={
                summary?.low_rotation_threshold && summary.low_rotation_threshold > 0
                  ? `Threshold: ${summary.low_rotation_threshold} rotations/yr`
                  : summary?.avg_rotation_rate !== undefined
                    ? `Avg rotation: ${summary.avg_rotation_rate.toFixed(4)}x/yr`
                    : undefined
              }
              icon={TrendingDown}
              iconBg="bg-amber-100 dark:bg-amber-900/40"
              iconColor="text-amber-600"
            />
          </div>

          {/* ── Top Rotation Rate chart ── */}
          {rotationChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-green-600" />
                  Top Rotation Rate Products
                </CardTitle>
                <CardDescription>
                  Rotation = qty sold / avg stock · higher is better
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rotationChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                    <RechartsTooltip
                      formatter={(v: number) => [`${v} rotations`, 'Rotation Rate']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="rotation" name="Rotation Rate" radius={[0, 4, 4, 0]}>
                      {rotationChartData.map((_, i) => (
                        <Cell key={i} fill={ROTATION_COLORS[i % ROTATION_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Low Rotation + Coverage at Risk ── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Low rotation products */}
            {lowRotation.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-amber-600" />
                    Low Rotation Products
                    <Badge variant="secondary" className="ml-1">{lowRotation.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Capital tied up in slow-moving stock — sorted by value immobilized
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {lowRotation.slice(0, 15).map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-accent/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={p.product_name}>
                            {p.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{p.material_code}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-amber-600">{formatCurrency(p.stock_value)}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.rotation_rate.toFixed(2)}x rotation
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Coverage at risk */}
            {coverageAtRisk.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-red-600" />
                    Coverage at Risk
                    <Badge variant="destructive" className="ml-1">{coverageAtRisk.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Products with fewest days of supply remaining — reorder soon
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {coverageAtRisk.slice(0, 15).map((p, i) => {
                      const days = p.coverage_days;
                      const urgency = days === null ? 'gray'
                                    : days <= 7  ? 'red'
                                    : days <= 30 ? 'orange'
                                    : 'yellow';
                      const badgeClass = {
                        red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
                        orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
                        yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
                        gray: 'bg-gray-100 text-gray-600',
                      }[urgency];
                      return (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-accent/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={p.product_name}>
                              {p.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Stock: {formatNumber(p.stock_qty)} units · Sold: {formatNumber(p.qty_sold)}/yr
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${badgeClass}`}>
                            {days === null ? '∞' : `${days}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Zero stock products ── */}
          {zeroStock.length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <ShieldAlert className="h-4 w-4" />
                  Zero Stock Products
                  <Badge variant="destructive">{zeroStock.length}</Badge>
                </CardTitle>
                <CardDescription>
                  These products are completely out of stock. Last period sales shown as demand indicator.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground uppercase">
                        <th className="py-2 text-left font-semibold">Product</th>
                        <th className="py-2 text-left font-semibold">Code</th>
                        <th className="py-2 text-left font-semibold">Category</th>
                        <th className="py-2 text-right font-semibold">Qty Sold (period)</th>
                        <th className="py-2 text-right font-semibold">Revenue Lost (est.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {zeroStock.slice(0, 20).map((p, i) => (
                        <tr key={i} className="hover:bg-accent/30">
                          <td className="py-2 font-medium max-w-[200px] truncate" title={p.product_name}>
                            {p.product_name}
                          </td>
                          <td className="py-2 font-mono text-xs text-muted-foreground">{p.material_code}</td>
                          <td className="py-2 text-muted-foreground">{p.category ?? '—'}</td>
                          <td className="py-2 text-right">
                            {p.qty_sold > 0
                              ? <span className="text-amber-600 font-medium">{formatNumber(p.qty_sold)}</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-2 text-right">
                            {p.revenue > 0
                              ? <span className="text-red-600 font-medium">{formatCurrency(p.revenue)}</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {zeroStock.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Showing 20 of {zeroStock.length} zero-stock products
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}