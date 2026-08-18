import type { ToastItem } from "../lib/toasts";

type Props = {
  items: ToastItem[];
};

export function ToastViewport({ items }: Props) {
  return (
    <div className="ui-toasts" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`ui-toast is-${item.tone}`}>
          <div>
            <strong>{item.title}</strong>
            {item.detail ? <span>{item.detail}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
