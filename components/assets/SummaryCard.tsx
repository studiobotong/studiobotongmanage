import type { ElementType } from "react";

interface SummaryCardProps {
  title: string;
  value: string;
  suffix?: string;
  sub?: string;
  subColor?: string;
  valueColor?: string;
  accentColor?: string;
  icon: ElementType;
  iconColor?: string;
  iconBg?: string;
}

export default function SummaryCard({
  title,
  value,
  suffix,
  sub,
  subColor = "text-gray-400",
  valueColor = "text-gray-900",
  accentColor = "border-l-[#5b6af4]",
  icon: Icon,
  iconColor = "text-[#5b6af4]",
  iconBg = "bg-[#eef0fe]",
}: SummaryCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 border-l-4 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${accentColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {title}
          </p>
          <div className="flex items-baseline gap-1.5 mt-2 flex-wrap">
            <p
              className={`text-2xl font-bold tabular-nums leading-tight ${valueColor}`}
            >
              {value}
            </p>
            {suffix && (
              <span className="text-sm font-medium text-gray-400">{suffix}</span>
            )}
          </div>
          {sub && (
            <p className={`text-xs mt-2 font-medium ${subColor}`}>{sub}</p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
