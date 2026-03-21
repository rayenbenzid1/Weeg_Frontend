/**
 * src/app/lib/aiInsightsApi.ts
 * ─────────────────────────────
 * All types + API calls for the Intelligent Analysis sprint.
 * Uses the existing apiFetch/api client with JWT auto-refresh.
 */

import { api } from './api';

const BASE = '/ai-insights';

// ── Shared ────────────────────────────────────────────────────────────────────

export type Severity   = 'low' | 'medium' | 'high' | 'critical';
export type Confidence = 'low' | 'medium' | 'high';
export type TrafficLight = 'green' | 'amber' | 'red';

// ── SCRUM-35: Critical Detector ───────────────────────────────────────────────

export interface CriticalSituation {
  source:                 string;
  title:                  string;
  severity:               Severity;
  composite_score:        number;
  summary:                string;
  financial_exposure_lyd: number;
  recommended_action:     string;
  urgency_hours:          number;
  customer_name?:         string;   // churn situations
  account_name?:          string;   // aging situations
  product_name?:          string;   // stock situations
}

export interface GroupedAction {
  situation: string;
  action:    string;
  owner:     string;
}

export interface CausalCluster {
  cluster_name:           string;
  situations:             string[];
  common_cause:           string;
  unified_action:         string;
  combined_exposure_lyd?: number;
}

export interface CriticalDetectionResult {
  generated_at:         string;
  user_role?:           string;
  allowed_sources?:     string[];
  critical_count:       number;
  total_situations:     number;
  total_exposure_lyd:   number;
  risk_level:           Severity;
  executive_briefing:   string;
  situations:           CriticalSituation[];
  causal_clusters:      CausalCluster[];
  grouped_actions: {
    act_within_24h: GroupedAction[];
    act_this_week:  GroupedAction[];
    monitor:        GroupedAction[];
  };
  confidence: Confidence;
  cached:     boolean;
}

// ── SCRUM-24: KPI Analyzer ────────────────────────────────────────────────────

export interface KPIValue {
  current:      number;
  baseline:     number;
  delta_pct:    number;
  status:       TrafficLight;
}

export interface KPIRecommendation {
  priority: number;
  action:   string;
  owner:    string;
  impact:   string;
}

export interface KPIResult {
  period_days:         number;
  computed_at:         string;
  health_score:        number;
  health_label:        string;
  kpis:                Record<string, KPIValue>;
  executive_summary:   string;
  top_insight:         string;
  kpi_commentary:      Record<string, string>;
  recommended_actions: KPIRecommendation[];
  risk_flags:          string[];
  summary: {
    total_kpis: number;
    green:      number;
    amber:      number;
    red:        number;
  };
  confidence: Confidence;
  cached:     boolean;
}

// ── SCRUM-25: Anomaly Detector ────────────────────────────────────────────────

export interface Anomaly {
  stream:               string;
  date:                 string;
  observed_value:       number;
  expected_value:       number;
  z_score:              number;
  deviation_pct:        number;
  direction:            'spike' | 'drop';
  severity:             Severity;
  anomaly_type:         string;
  baseline_mean:        number;
  baseline_std:         number;
  ai_explanation:       string;
  likely_causes:        string[];
  business_impact:      string;
  recommended_actions:  string[];
  confidence:           Confidence;
}

export interface AnomalyResult {
  detection_window_days: number;
  baseline_weeks:        number;
  summary: {
    total:    number;
    critical: number;
    high:     number;
    medium:   number;
    low:      number;
  };
  anomalies: Anomaly[];
  cached:    boolean;
}

// ── SCRUM-26: Seasonal Analyzer ───────────────────────────────────────────────

export interface SeasonalityIndex {
  month_num:                  number;
  month_name:                 string;
  seasonality_index:          number | null;
  avg_monthly_revenue_lyd:    number;
  data_points:                number;
  label:                      'peak' | 'trough' | 'normal' | 'no_data';
}

export interface SeasonalTrend {
  direction:             string;
  slope_pct_per_month:   number;
  slope_lyd_per_month:   number;
  r_squared:             number;
}

export interface CategoryPattern {
  category:         string;
  peak_month:       number;
  peak_month_name:  string;
  peak_index:       number;
  trough_month:     number;
  trough_month_name: string;
  trough_index:     number;
}

export interface StockCalendarItem {
  month:           string;
  action:          string;
  lead_time_weeks: number;
  rationale:       string;
}

export interface RamadanAnalysis {
  detected:          boolean;
  years_analyzed:    number[];
  avg_ramadan_index: number;
  dominant_effect:   string;
  adjustment_note:   string;
}

export interface SeasonalResult {
  /** Set by the backend when there is insufficient data */
  error?:                     string;
  history_months:             number;
  current_season:             string;
  upcoming_peak_alert:        boolean;
  trend:                      SeasonalTrend;
  seasonality_indices:        Record<string, SeasonalityIndex>;
  peak_months:                number[];
  peak_month_names:           string[];
  trough_months:              number[];
  trough_month_names:         string[];
  category_patterns:          CategoryPattern[];
  ramadan_analysis?:          RamadanAnalysis;
  seasonal_narrative:         string;
  stock_preparation_calendar: StockCalendarItem[];
  staffing_implications:      string;
  ai_recommendations:         string[];
  confidence:                 Confidence;
  cached:                     boolean;
}

// ── SCRUM-27: Churn Prediction ────────────────────────────────────────────────

export interface ChurnPrediction {
  customer_id:               string | null;
  account_code:              string;
  customer_name:             string;
  churn_score:               number;
  churn_label:               Severity;
  days_since_last_purchase:  number;
  purchase_count_12m:        number;
  avg_monthly_revenue_lyd:   number;
  avg_order_value_lyd:       number;
  revenue_trend:             number;
  aging_risk_score:          string;
  overdue_ratio:             number;
  total_receivable_lyd:      number;
  ai_explanation:            string;
  recommended_actions:       string[];
  key_risk_factors:          string[];
  confidence:                Confidence;
}

export interface ChurnResult {
  company_id:  string;
  top_n:       number;
  ai_used:     boolean;
  summary: {
    total:           number;
    critical:        number;
    high:            number;
    medium:          number;
    low:             number;
    avg_churn_score: number;
  };
  predictions: ChurnPrediction[];
  cached:      boolean;
}

// ── SCRUM-28: Stock Optimizer ─────────────────────────────────────────────────

export interface StockItem {
  product_code:             string;
  product_name:             string;
  abc_class:                'A' | 'B' | 'C';
  total_revenue_lyd:        number;
  revenue_pct:              number;
  cumulative_pct:           number;
  current_stock:            number;
  avg_daily_demand:         number;
  revenue_per_unit_lyd:     number;
  reorder_point:            number;
  safety_stock:             number;
  eoq:                      number;
  estimated_days_to_stockout: number | null;
  urgency:                  'immediate' | 'soon' | 'watch' | 'ok';
  ai_recommendation:        string;
  order_suggestion:         {
    quantity: number;
    timing:   string;
    rationale: string;
  };
  revenue_at_risk_lyd:      number;
  confidence:               Confidence;
}

export interface StockResult {
  analysis_window_days: number;
  lead_time_days:       number;
  service_level:        string;
  total_sku_count:      number;
  summary: {
    total_items:              number;
    class_a_count:            number;
    class_b_count:            number;
    class_c_count:            number;
    immediate_reorders:       number;
    soon_reorders:            number;
    items_at_or_below_rop:    number;
    total_revenue_covered_lyd: number;
  };
  items:  StockItem[];
  cached: boolean;
}

// ── SCRUM-30: Predictor ───────────────────────────────────────────────────────

export interface ForecastMonth {
  month:              number;
  year:               number;
  period:             string;
  base_lyd:           number;
  optimistic_lyd:     number;
  pessimistic_lyd:    number;
  seasonality_index:  number;
  trend_component:    number;
  upside_pct:         number;
  downside_pct:       number;
}

export interface TrendModel {
  slope:              number;
  intercept:          number;
  slope_pct:          number;
  r_squared:          number;
  residual_std:       number;
  last_t:             number;
  avg_revenue:        number;
  direction:          string;
}

export interface PredictorRecommendation {
  month_target:         string;
  action:               string;
  owner:                string;
  expected_impact_lyd:  number;
}

export interface CashFlowMonth {
  period:                       string;
  expected_revenue_lyd:         number;
  expected_cash_collected_lyd:  number;
  collection_rate_pct:          number;
  collection_gap_lyd:           number;
}

export interface PredictorResult {
  error?:                       string;
  forecast_months:              number;
  history_months_used:          number;
  trend_model:                  TrendModel;
  revenue_forecast:             ForecastMonth[];
  forecast_total_base_lyd:      number;
  forecast_total_optimistic_lyd:    number;
  forecast_total_pessimistic_lyd:   number;
  customer_forecast:            Array<{
    period:                       string;
    projected_active_customers:   number;
    trend_per_month:              number;
  }>;
  cash_flow_forecast:           {
    current_receivable_lyd:   number;
    current_overdue_lyd:      number;
    collection_rate_pct:      number;
    monthly_projections:      CashFlowMonth[];
  };
  forecast_narrative:  string;
  primary_risk:        string;
  recommendations:     PredictorRecommendation[];
  confidence:          Confidence;
  cached:              boolean;
}

// ── API methods ───────────────────────────────────────────────────────────────

function qs(params: Record<string, string | boolean | number | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const aiInsightsApi = {
  critical: (params?: { use_ai?: boolean; refresh?: boolean }) =>
    api.get<CriticalDetectionResult>(`${BASE}/critical/${qs(params ?? {})}`),

  kpis: (params?: { use_ai?: boolean; refresh?: boolean }) =>
    api.get<KPIResult>(`${BASE}/kpis/${qs(params ?? {})}`),

  anomalies: (params?: { use_ai?: boolean; refresh?: boolean }) =>
    api.get<AnomalyResult>(`${BASE}/anomalies/${qs(params ?? {})}`),

  seasonal: (params?: { use_ai?: boolean; refresh?: boolean }) =>
    api.get<SeasonalResult>(`${BASE}/seasonal/${qs(params ?? {})}`),

  churn: (params?: { top_n?: number; use_ai?: boolean; refresh?: boolean }) =>
    api.get<ChurnResult>(`${BASE}/churn/${qs(params ?? {})}`),

  stock: (params?: { use_ai?: boolean; refresh?: boolean }) =>
    api.get<StockResult>(`${BASE}/stock/${qs(params ?? {})}`),

  predict: (params?: { use_ai?: boolean; refresh?: boolean }) =>
    api.get<PredictorResult>(`${BASE}/predict/${qs(params ?? {})}`),
};