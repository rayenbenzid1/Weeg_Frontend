// Utility functions for WEEG platform

export const formatCurrency = (amount?: number | null): string => {
  const n = typeof amount === "number" && isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatNumber = (num?: number | null): string => {
  const n = typeof num === "number" && isFinite(num) ? num : 0;
  return new Intl.NumberFormat("en-US").format(n);
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const getAgingStatus = (
  daysOverdue: number,
): "current" | "warning" | "critical" => {
  if (daysOverdue <= 30) return "current";
  if (daysOverdue <= 60) return "warning";
  return "critical";
};

export const getAgingColor = (daysOverdue: number): string => {
  if (daysOverdue <= 30) return "text-green-600";
  if (daysOverdue <= 60) return "text-yellow-600";
  return "text-red-600";
};

export const getStockStatus = (
  current: number,
  min: number,
  max: number,
): "normal" | "low" | "critical" => {
  const percentage = max ? (current / max) * 100 : 0;
  if (percentage >= 30) return "normal";
  if (current > min) return "low";
  return "critical";
};

export const getStockColor = (
  status: "normal" | "low" | "critical",
): string => {
  switch (status) {
    case "normal":
      return "bg-green-500";
    case "low":
      return "bg-yellow-500";
    case "critical":
      return "bg-red-500";
  }
};

export const getAlertIcon = (type: string): string => {
  switch (type) {
    case "low_stock":
      return "📦";
    case "high_sales":
      return "📈";
    case "risk":
      return "⚠️";
    case "overdue":
      return "💰";
    case "sales_drop":
      return "📉";
    case "exchange_rate":
      return "💱";
    case "seasonal":
      return "🌡️";
    default:
      return "🔔";
  }
};

export const getSeverityColor = (
  severity: "low" | "medium" | "critical",
): string => {
  switch (severity) {
    case "low":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  }
};

export const calculateTrend = (
  current: number,
  previous?: number | null,
): { value: number; isPositive: boolean } => {
  const prev =
    typeof previous === "number" && isFinite(previous) ? previous : 0;
  if (prev === 0) return { value: 0, isPositive: current >= 0 };
  const change = ((current - prev) / prev) * 100;
  return {
    value: Math.abs(change),
    isPositive: change >= 0,
  };
};

export const generateSparklineData = (length: number = 7): number[] => {
  const data: number[] = [];
  let value = Math.random() * 100 + 50;

  for (let i = 0; i < length; i++) {
    data.push(value);
    value += (Math.random() - 0.5) * 20;
    value = Math.max(0, Math.min(150, value));
  }

  return data;
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          return typeof value === "string" && value.includes(",")
            ? `"${value}"`
            : value;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

export const cn = (
  ...classes: (string | undefined | null | false)[]
): string => {
  return classes.filter(Boolean).join(" ");
};
