import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { clsx } from "clsx";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  suffix?: string;
}

export default function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-[#5b6af4]",
  iconBg = "bg-[#eef0fe]",
  suffix,
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1 mt-2">
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
            {suffix && <span className="text-sm text-gray-400 font-medium">{suffix}</span>}
          </div>
          {change && (
            <div
              className={clsx(
                "flex items-center gap-1 mt-2 text-xs font-medium",
                changeType === "up" && "text-emerald-600",
                changeType === "down" && "text-red-500",
                changeType === "neutral" && "text-gray-400"
              )}
            >
              {changeType === "up" && <TrendingUp className="w-3 h-3" />}
              {changeType === "down" && <TrendingDown className="w-3 h-3" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={clsx("w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0", iconBg)}>
          <Icon className={clsx("w-5 h-5", iconColor)} />
        </div>
      </div>
    </div>
  );
}
