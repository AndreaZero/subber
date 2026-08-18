import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function Button({
  variant = "subtle",
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button type={type} className={`ui-btn is-${variant} ${className}`} {...rest}>
      {children}
    </button>
  );
}
