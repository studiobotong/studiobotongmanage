import { clsx } from "clsx";
import { LucideIcon } from "lucide-react";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  className,
  onClick,
  disabled,
  type = "button",
  fullWidth = false,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "text-xs px-3 py-1.5",
        size === "md" && "text-sm px-4 py-2.5",
        size === "lg" && "text-sm px-6 py-3",
        variant === "primary" &&
          "bg-[#5b6af4] text-white hover:bg-[#4a58e8] shadow-sm hover:shadow-md active:scale-[0.98]",
        variant === "secondary" &&
          "bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-[0.98]",
        variant === "ghost" &&
          "bg-transparent text-gray-600 hover:bg-gray-100 active:scale-[0.98]",
        variant === "danger" &&
          "bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98]",
        fullWidth && "w-full",
        className
      )}
    >
      {Icon && iconPosition === "left" && <Icon className="w-4 h-4 flex-shrink-0" />}
      {children}
      {Icon && iconPosition === "right" && <Icon className="w-4 h-4 flex-shrink-0" />}
    </button>
  );
}
