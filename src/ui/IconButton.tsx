import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  children: ReactNode;
};

export function IconButton({
  label,
  active,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`ui-icon-btn ${active ? "is-active" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
