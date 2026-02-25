import { useMemo, useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, Package, DollarSign, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DataTable } from '../components/DataTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  useAgingRisk,
  useInventory,
  useTransactionSummary,
  useAgingList,
} from '../lib/dataHooks';
import { formatCurrency, formatDate } from '../lib/utils';

// ─────────────────────────────────────────────
// Smart alert generation from real data
// ─────────────────────────────────────────────

type AlertSeverity = 'low' | 'medium' | 'critical';
type AlertType = 'overdue' | 'risk' | 'low_stock' | 'sales_drop' | 'high_receivables';

interface SmartAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  detail: string;
  date: string;
  status: 'pending' | 'resolved';
  aiExplanation: string;
  metadata: Record<string, any>;
}

const TYPE_ICONS: Record<AlertType, string> = {
  overdue: '💰',
  risk: '⚠️',
  low_stock: '📦',
  sales_drop: '📉',
  high_receivables: '🏦',
};

const TYPE_LABELS: Record<AlertType, string> = {
  overdue: 'Overdue Payment',
  risk: 'Credit Risk',
  low_stock: 'Low Stock',
  sales_drop: 'Sales Drop',
  high_receivables: 'High Receivables',
};

const today = new Date().toISOString().split('T')[0];

export function AlertsPage() {
  const [selectedAlert, setSelectedAlert] = useState<SmartAlert | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  // ── Real data ────────────────────────────────────────────────────────
  const { data: agingRiskRes, loading: riskLoading, refetch: refetchRisk } = useAgingRisk({ limit: 10 });
  const { data: agingListRes, loading: agingLoading } = useAgingList({ page_size: 100 });
  const { data: inventoryRes, loading: invLoading } = useInventory({ page_size: 200 });
  const { data: summaryRes, loading: summaryLoading } = useTransactionSummary();

  const isLoading = riskLoading || agingLoading || invLoading || summaryLoading;

  // ── Generate intelligent alerts from real data ───────────────────────
  const alerts = useMemo<SmartAlert[]>(() => {
    const generated: SmartAlert[] = [];

    // 1. Critical/high risk customers → overdue + risk alerts
    const topRisk = agingRiskRes?.top_risk ?? [];
    topRisk.forEach((r, i) => {
      const severity: AlertSeverity = r.risk_score === 'critical' ? 'critical' : r.risk_score === 'high' ? 'critical' : 'medium';

      if (r.overdue_total > 0) {
        generated.push({
          id: `overdue-${r.id}`,
          type: 'overdue',
          severity,
          message: `${r.customer_name || r.account} has overdue balance of ${formatCurrency(r.overdue_total)}`,
          detail: `Account ${r.account_code} · Total exposure: ${formatCurrency(r.total)}`,
          date: today,
          status: 'pending',
          aiExplanation: `Customer ${r.customer_name || r.account} has an overdue balance of ${formatCurrency(r.overdue_total)} out of a total receivable of ${formatCurrency(r.total)}. Risk level is classified as "${r.risk_score.toUpperCase()}". Immediate follow-up is recommended to prevent further aging. Consider suspending credit until partial payment is received.`,
          metadata: { ...r },
        });
      }

      if (['critical', 'high'].includes(r.risk_score)) {
        generated.push({
          id: `risk-${r.id}`,
          type: 'risk',
          severity,
          message: `${r.customer_name || r.account} has been flagged as "${r.risk_score}" credit risk`,
          detail: `Total receivable: ${formatCurrency(r.total)} · Overdue: ${formatCurrency(r.overdue_total)}`,
          date: today,
          status: 'pending',
          aiExplanation: `Risk assessment for ${r.customer_name || r.account} (${r.account_code}) indicates a "${r.risk_score.toUpperCase()}" credit risk profile based on aging bucket distribution. The customer has ${formatCurrency(r.overdue_total)} in overdue payments out of ${formatCurrency(r.total)} total receivables. A formal credit review and potential credit limit adjustment is advised.`,
          metadata: { ...r },
        });
      }
    });

    // 2. Aging records with very old overdue (>180 days)
    const agingRecords = agingListRes?.records ?? [];
    const oldOverdue = agingRecords.filter(r =>
      (r.d181_210 + r.d211_240 + r.d241_270 + r.d271_300 + r.d301_330 + r.over_330) > 0
    );
    oldOverdue.slice(0, 3).forEach(r => {
      const veryOld = r.d181_210 + r.d211_240 + r.d241_270 + r.d271_300 + r.d301_330 + r.over_330;
      generated.push({
        id: `old-overdue-${r.id}`,
        type: 'high_receivables',
        severity: 'critical',
        message: `${r.customer_name || r.account} has ${formatCurrency(veryOld)} overdue beyond 6 months`,
        detail: `Report date: ${r.report_date} · Total: ${formatCurrency(r.total)}`,
        date: r.report_date,
        status: 'pending',
        aiExplanation: `${r.customer_name || r.account} has ${formatCurrency(veryOld)} in receivables that have been outstanding for more than 180 days. This represents a high probability of irrecoverable debt. Legal or collection agency involvement should be considered. Immediate management escalation recommended.`,
        metadata: { ...r },
      });
    });

    // 3. Inventory alerts: zero stock or very low
    const invItems = inventoryRes?.items ?? [];
    const zeroStock = invItems.filter(i => i.total_qty === 0);
    const lowStock = invItems.filter(i => i.total_qty > 0 && i.total_qty < 5);

    zeroStock.slice(0, 5).forEach(item => {
      generated.push({
        id: `zero-stock-${item.id}`,
        type: 'low_stock',
        severity: 'critical',
        message: `${item.product_name} is completely out of stock across all branches`,
        detail: `Product code: ${item.product_code}${item.category ? ` · Category: ${item.category}` : ''}`,
        date: item.snapshot_date,
        status: 'pending',
        aiExplanation: `${item.product_name} (${item.product_code}) has zero units in inventory across all branches as of ${item.snapshot_date}. This may cause stockouts and lost sales. Immediate reorder is recommended. Review historical sales velocity to determine optimal reorder quantity.`,
        metadata: { ...item },
      });
    });

    lowStock.slice(0, 3).forEach(item => {
      generated.push({
        id: `low-stock-${item.id}`,
        type: 'low_stock',
        severity: 'medium',
        message: `${item.product_name} has critically low stock (${item.total_qty} units)`,
        detail: `Product code: ${item.product_code} · Value: ${formatCurrency(item.total_value)}`,
        date: item.snapshot_date,
        status: 'pending',
        aiExplanation: `${item.product_name} currently has only ${item.total_qty} units in stock (total value: ${formatCurrency(item.total_value)}). At this level, a stockout is likely imminent. Based on the current inventory distribution, consider redistribution from higher-stocked branches and placing a reorder soon.`,
        metadata: { ...item },
      });
    });

    // 4. Sales trend alerts: significant month-over-month drops
    const summary = summaryRes?.summary ?? [];
    if (summary.length >= 2) {
      const sorted = [...summary].sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));
      const prev = sorted[sorted.length - 2];
      const curr = sorted[sorted.length - 1];
      if (prev.total_sales > 0) {
        const pctChange = ((curr.total_sales - prev.total_sales) / prev.total_sales) * 100;
        if (pctChange < -15) {
          generated.push({
            id: `sales-drop-${curr.year}-${curr.month}`,
            type: 'sales_drop',
            severity: Math.abs(pctChange) > 30 ? 'critical' : 'medium',
            message: `Sales dropped ${Math.abs(pctChange).toFixed(1)}% from ${prev.month_label} to ${curr.month_label}`,
            detail: `${prev.month_label}: ${formatCurrency(prev.total_sales)} → ${curr.month_label}: ${formatCurrency(curr.total_sales)}`,
            date: today,
            status: 'pending',
            aiExplanation: `Sales declined by ${Math.abs(pctChange).toFixed(1)}% from ${prev.month_label} (${formatCurrency(prev.total_sales)}) to ${curr.month_label} (${formatCurrency(curr.total_sales)}). This significant drop warrants investigation. Potential causes include seasonal patterns, competitor activity, or supply issues. Compare with inventory levels and customer order patterns to identify root cause.`,
            metadata: { prev, curr, pctChange },
          });
        }
      }
    }

    return generated;
  }, [agingRiskRes, agingListRes, inventoryRes, summaryRes]);

  // Apply resolved state and filter
  const enrichedAlerts = alerts.map(a => ({
    ...a,
    status: resolved.has(a.id) ? 'resolved' as const : 'pending' as const,
  }));

  const filteredAlerts = enrichedAlerts.filter(a =>
    filter === 'all' ? true : a.status === filter
  );

  const counts = {
    all: enrichedAlerts.length,
    pending: enrichedAlerts.filter(a => a.status === 'pending').length,
    resolved: enrichedAlerts.filter(a => a.status === 'resolved').length,
    critical: enrichedAlerts.filter(a => a.severity === 'critical').length,
  };

  const handleResolve = (id: string) => {
    setResolved(prev => new Set([...prev, id]));
    if (selectedAlert?.id === id) setSelectedAlert(null);
  };

  const severityColor = (s: AlertSeverity) => ({
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }[s]);

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (row: SmartAlert) => (
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_ICONS[row.type]}</span>
          <span className="font-medium text-sm">{TYPE_LABELS[row.type]}</span>
        </div>
      ),
    },
    {
      key: 'message',
      label: 'Alert',
      render: (row: SmartAlert) => (
        <div>
          <p className="font-medium text-sm">{row.message}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{row.detail}</p>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (row: SmartAlert) => formatDate(row.date),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row: SmartAlert) => (
        <Badge className={severityColor(row.severity)}>{row.severity}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: SmartAlert) => (
        <Badge variant={row.status === 'pending' ? 'secondary' : 'default'}>
          {row.status === 'pending' ? '⏳ Pending' : '✓ Resolved'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: SmartAlert) => (
        <div className="flex gap-2">
          {row.status === 'pending' && (
            <Button variant="outline" size="sm" onClick={() => handleResolve(row.id)}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Resolve
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(row)}>
            <Sparkles className="h-4 w-4 mr-1" />
            AI Explain
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Smart Alerts</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered alerts generated automatically from your live business data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchRisk} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* AI Banner */}
      <Card className="border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 shrink-0">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Intelligent Alert Engine</h3>
              <p className="text-sm text-muted-foreground">
                Alerts are automatically generated by analyzing your aging receivables, inventory snapshots, and transaction trends in real time — no manual configuration required.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge className="bg-indigo-600">{counts.all} Alerts Generated</Badge>
                <Badge className="bg-red-600">{counts.critical} Critical</Badge>
                <Badge variant="outline">Live Data</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="ml-3 text-muted-foreground">Analyzing business data for alerts...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Stats */}
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.all}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{counts.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{counts.resolved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Critical</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{counts.critical}</div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Alert Management</CardTitle>
                  <CardDescription>Monitor and resolve automatically-detected business alerts</CardDescription>
                </div>
                <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                    <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
                    <TabsTrigger value="resolved">Resolved ({counts.resolved})</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-60" />
                  <p>No alerts in this category. Great work!</p>
                </div>
              ) : (
                <DataTable
                  data={filteredAlerts}
                  columns={columns}
                  searchable
                  exportable
                  pageSize={10}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* AI Explanation Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              AI Alert Analysis
            </DialogTitle>
            <DialogDescription>Intelligent insights and recommendations</DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4 pt-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{TYPE_ICONS[selectedAlert.type]}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">{selectedAlert.message}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{selectedAlert.detail}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className={severityColor(selectedAlert.severity)}>{selectedAlert.severity}</Badge>
                      <Badge variant="outline">{TYPE_LABELS[selectedAlert.type]}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  AI Analysis & Recommendation
                </h5>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedAlert.aiExplanation}
                </p>
              </div>

              <div className="grid gap-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm font-medium">Data Source</span>
                  <span className="text-sm text-muted-foreground">Live backend — {selectedAlert.date}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm font-medium">Alert Generated</span>
                  <span className="text-sm text-muted-foreground">Automatically from real data</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                {selectedAlert.status === 'pending' && (
                  <Button className="flex-1" onClick={() => handleResolve(selectedAlert.id)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Resolved
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
