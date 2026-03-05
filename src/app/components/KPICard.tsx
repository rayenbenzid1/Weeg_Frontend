import { LucideIcon } from 'lucide-react';
import { Card } from './ui/card';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { generateSparklineData } from '../lib/utils';

interface KPICardProps {
  title: string;
  value: string | number | React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  iconColor?: string;
  showSparkline?: boolean;
}

export function KPICard({
  title,
  value,
  trend,
  icon: Icon,
  iconColor = 'text-sky-600',
  showSparkline = true,
}: KPICardProps) {
  const sparklineData = generateSparklineData().map((value, index) => ({ index, value }));

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950 dark:to-blue-950">
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            {/* <span>{trend.value.toFixed(1)}%</span> */}
            <span>{(trend.value ?? 0).toFixed(1)}%</span>

          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>

      {showSparkline && (
        <div className="mt-4 h-12 w-full">
          <ResponsiveContainer width="100%" height={48}>
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0284c7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}