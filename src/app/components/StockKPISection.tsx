// src/app/components/StockKPISection.tsx
import { useState } from 'react';
import {
  Package, RotateCcw, AlertTriangle, ShieldAlert, Calendar,
  Loader2, AlertCircle, RefreshCw, TrendingDown, ArrowUpRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useStockKPI } from '../lib/dataHooks';
import { formatCurrency, formatNumber } from '../lib/utils';

// ── Brand palette (chart colors only) ────────────────────────────────────
const C = {
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  cyan:    '#0ea5e9',
  teal:    '#14b8a6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  orange:  '#f97316',
  rose:    '#f43f5e',
};

const ROTATION_COLORS = [C.emerald, '#34d399', '#a3e635', C.amber, C.orange];

// ── CSS-variable-based helpers ────────────────────────────────────────────
const css = {
  card:      'hsl(var(--card))',
  cardFg:    'hsl(var(--card-foreground))',
  border:    'hsl(var(--border))',
  muted:     'hsl(var(--muted))',
  mutedFg:   'hsl(var(--muted-foreground))',
  bg:        'hsl(var(--background))',
  fg:        'hsl(var(--foreground))',
  popover:   'hsl(var(--popover))',
  popoverFg: 'hsl(var(--popover-foreground))',
};

const cardStyle: React.CSSProperties = {
  background:   css.card,
  borderRadius: 16,
  padding:      24,
  boxShadow:    '0 1px 3px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.05)',
  border:       `1px solid ${css.border}`,
};

const axisStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

// ── Custom Tooltip ────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   css.popover,
      border:       `1px solid ${css.border}`,
      borderRadius: 10,
      padding:      '10px 14px',
      boxShadow:    '0 8px 24px rgba(0,0,0,0.15)',
      fontSize:     12,
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg, marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: css.mutedFg }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', paddingLeft: 16, fontWeight: 700, color: css.popoverFg }}>
            {typeof p.value === 'number' && p.name !== 'Rotation Rate'
              ? formatCurrency(p.value)
              : `${p.value} rotations`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Loader / Empty ────────────────────────────────────────────────────────
function Loader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: css.mutedFg }}>
      <Loader2 size={15} className="animate-spin" />
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.mutedFg, fontSize: 13 }}>
      No data available
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KPI({
  title, value, sub, icon: Icon, accent,
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
      {/* soft glow */}
      <div style={{
        position: 'absolute', top: -24, right: -24, width: 80, height: 80,
        borderRadius: '50%', background: accent, opacity: 0.08,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
        <ArrowUpRight size={13} style={{ color: C.emerald }} />
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: css.mutedFg }}>
        {title}
      </p>
      <p style={{ fontSize: 20, fontWeight: 800, color: css.cardFg, marginTop: 4, letterSpacing: '-0.03em' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: css.mutedFg, marginTop: 4 }}>{sub}</p>
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────
function Panel({
  title, sub, accentColor, badge, children,
}: {
  title: string; sub?: string;
  accentColor?: string; badge?: { label: string; variant?: 'default' | 'danger' };
  children: React.ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: css.cardFg, margin: 0 }}>{title}</h3>
          {sub && <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>{sub}</p>}
        </div>
        {badge && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: badge.variant === 'danger' ? `${C.rose}18` : `${C.amber}18`,
            color: badge.variant === 'danger' ? C.rose : C.amber,
            border: `1px solid ${badge.variant === 'danger' ? C.rose : C.amber}35`,
          }}>
            {badge.label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Year toggle button ────────────────────────────────────────────────────
function YearBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: `1px solid ${active ? C.emerald : css.border}`,
        background: active ? `${C.emerald}18` : 'transparent',
        color: active ? C.emerald : css.mutedFg,
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function StockKPISection() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, loading, error, refetch } = useStockKPI({ year });

  const summary        = data?.stock_summary;
  const topRotation    = data?.top_rotation_products ?? [];
  const lowRotation    = data?.low_rotation_products ?? [];
  const zeroStock      = data?.zero_stock_products ?? [];
  const coverageAtRisk = data?.coverage_at_risk ?? [];

  const rotationChartData = topRotation.slice(0, 10).map(p => ({
    name:     p.product_name.slice(0, 18),
    rotation: parseFloat(p.rotation_rate.toFixed(2)),
  }));

  return (
    <div style={{ background: css.bg, minHeight: '100vh', padding: '32px 28px' }}>

      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: css.fg, letterSpacing: '-0.03em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10, background: `${C.emerald}18`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={18} style={{ color: C.emerald }} />
            </span>
            Stock KPIs
          </h1>
          <p style={{ fontSize: 13, color: css.mutedFg, marginTop: 4 }}>
            Rotation rates, coverage, slow movers &amp; stockouts
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[currentYear - 1, currentYear].map(y => (
              <YearBtn key={y} active={year === y} onClick={() => setYear(y)}>{y}</YearBtn>
            ))}
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            style={{
              width: 34, height: 34, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: `1px solid ${css.border}`,
              cursor: loading ? 'not-allowed' : 'pointer', color: css.mutedFg,
            }}
          >
            {loading
              ? <Loader2 size={15} className="animate-spin" />
              : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          ...cardStyle,
          display: 'flex', alignItems: 'center', gap: 12,
          borderColor: `${C.rose}40`, marginBottom: 20,
        }}>
          <AlertCircle size={18} style={{ color: C.rose, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: css.cardFg, flex: 1 }}>{error}</span>
          <button
            onClick={refetch}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: `1px solid ${css.border}`,
              background: 'transparent', color: css.mutedFg,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Full-page loader ── */}
      {loading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: css.mutedFg }}>
          <Loader2 size={22} className="animate-spin" style={{ color: C.emerald }} />
          <span style={{ fontSize: 14 }}>Loading stock KPIs…</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            <KPI
              title="Total Products"
              value={formatNumber(summary?.total_products ?? 0)}
              sub={`Total qty: ${formatNumber(summary?.total_qty ?? 0)}`}
              icon={Package}
              accent={C.indigo}
            />
            <KPI
              title="Total Stock Value"
              value={formatCurrency(summary?.total_value ?? 0)}
              sub={data.snapshot_date ? `Snapshot: ${data.snapshot_date}` : undefined}
              icon={Package}
              accent={C.emerald}
            />
            <KPI
              title="Zero Stock Products"
              value={String(summary?.zero_stock_count ?? 0)}
              sub="Out of stock — needs reorder"
              icon={AlertTriangle}
              accent={C.rose}
            />
            <KPI
              title="Low Rotation Products"
              value={String(summary?.low_rotation_count ?? 0)}
              sub={
                summary?.low_rotation_threshold && summary.low_rotation_threshold > 0
                  ? `Threshold: ${summary.low_rotation_threshold} rotations/yr`
                  : summary?.avg_rotation_rate !== undefined
                    ? `Avg: ${summary.avg_rotation_rate.toFixed(4)}x/yr`
                    : undefined
              }
              icon={TrendingDown}
              accent={C.amber}
            />
          </div>

          {/* ── Top Rotation Rate chart ── */}
          {rotationChartData.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Panel
                title="Top Rotation Rate Products"
                sub="Rotation = qty sold / avg stock · higher is better"
                accentColor={C.emerald}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rotationChartData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={css.border} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={130} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="rotation" name="Rotation Rate" radius={[0, 5, 5, 0]}>
                      {rotationChartData.map((_, i) => (
                        <Cell key={i} fill={ROTATION_COLORS[i % ROTATION_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          )}

          {/* ── Low Rotation + Coverage at Risk ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {lowRotation.length > 0 && (
              <Panel
                title="Low Rotation Products"
                sub="Capital tied up in slow-moving stock — sorted by value"
                badge={{ label: `${lowRotation.length}`, variant: 'default' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 288, overflowY: 'auto' }}>
                  {lowRotation.slice(0, 15).map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 10,
                      border: `1px solid ${css.border}`,
                      background: 'transparent',
                      transition: 'background 0.15s',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: `${C.amber}18`, border: `1px solid ${C.amber}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <TrendingDown size={14} style={{ color: C.amber }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: css.cardFg, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                           title={p.product_name}>
                          {p.product_name}
                        </p>
                        <p style={{ fontSize: 11, color: css.mutedFg, margin: 0, fontFamily: 'monospace' }}>{p.material_code}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.amber, margin: 0 }}>{formatCurrency(p.stock_value)}</p>
                        <p style={{ fontSize: 11, color: css.mutedFg, margin: 0 }}>{p.rotation_rate.toFixed(2)}x rotation</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {coverageAtRisk.length > 0 && (
              <Panel
                title="Coverage at Risk"
                sub="Products with fewest days of supply remaining — reorder soon"
                badge={{ label: `${coverageAtRisk.length}`, variant: 'danger' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 288, overflowY: 'auto' }}>
                  {coverageAtRisk.slice(0, 15).map((p, i) => {
                    const days = p.coverage_days;
                    const accent = days === null ? css.mutedFg
                                 : days <= 7    ? C.rose
                                 : days <= 30   ? C.orange
                                 : C.amber;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                          background: `${accent}18`, border: `1px solid ${accent}35`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Calendar size={14} style={{ color: accent }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: css.cardFg, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                 title={p.product_name}>
                                {p.product_name}
                              </p>
                              <p style={{ fontSize: 11, color: css.mutedFg, margin: 0 }}>
                                Stock: {formatNumber(p.stock_qty)} · Sold: {formatNumber(p.qty_sold)}/yr
                              </p>
                            </div>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                              background: `${accent}18`, color: accent, border: `1px solid ${accent}35`,
                              flexShrink: 0, marginLeft: 8,
                            }}>
                              {days === null ? '∞' : `${days}d`}
                            </span>
                          </div>
                          <div style={{ height: 5, borderRadius: 999, background: css.muted, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 999,
                              width: days === null ? '100%' : `${Math.min(100, 100 - (days / 90) * 100)}%`,
                              background: `linear-gradient(90deg, ${accent}55, ${accent})`,
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>

          {/* ── Zero Stock products ── */}
          {zeroStock.length > 0 && (
            <div style={{
              ...cardStyle,
              borderColor: `${C.rose}40`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${C.rose}18`, border: `1px solid ${C.rose}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ShieldAlert size={16} style={{ color: C.rose }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: C.rose, margin: 0 }}>Zero Stock Products</h3>
                    <p style={{ fontSize: 12, color: css.mutedFg, marginTop: 3 }}>
                      Completely out of stock. Last period sales shown as demand indicator.
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: `${C.rose}18`, color: C.rose, border: `1px solid ${C.rose}35`,
                }}>
                  {zeroStock.length}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${css.border}` }}>
                      {['Product', 'Code', 'Category', 'Qty Sold (period)', 'Revenue Lost (est.)'].map(h => (
                        <th key={h} style={{
                          padding: '8px 10px',
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: css.mutedFg,
                          textAlign: h.startsWith('Qty') || h.startsWith('Rev') ? 'right' : 'left',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zeroStock.slice(0, 20).map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${css.border}` }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: css.cardFg }}
                            title={p.product_name}>
                          {p.product_name}
                        </td>
                        <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 11, color: css.mutedFg }}>{p.material_code}</td>
                        <td style={{ padding: '10px 10px', color: css.mutedFg }}>{p.category ?? '—'}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          {p.qty_sold > 0
                            ? <span style={{ color: C.amber, fontWeight: 700 }}>{formatNumber(p.qty_sold)}</span>
                            : <span style={{ color: css.mutedFg, opacity: 0.4 }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          {p.revenue > 0
                            ? <span style={{ color: C.rose, fontWeight: 700 }}>{formatCurrency(p.revenue)}</span>
                            : <span style={{ color: css.mutedFg, opacity: 0.4 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {zeroStock.length > 20 && (
                  <p style={{ fontSize: 12, color: css.mutedFg, textAlign: 'center', marginTop: 12 }}>
                    Showing 20 of {zeroStock.length} zero-stock products
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}