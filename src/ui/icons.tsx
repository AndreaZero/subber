import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function Svg({ children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...rest}>
      {children}
    </svg>
  );
}

export function IconHome() {
  return (
    <Svg>
      <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function IconJobs() {
  return (
    <Svg>
      <rect x="4" y="5" width="16" height="4" rx="1.4" />
      <rect x="4" y="11" width="16" height="4" rx="1.4" />
      <rect x="4" y="17" width="10" height="3" rx="1.2" />
    </Svg>
  );
}

export function IconHistory() {
  return (
    <Svg>
      <path d="M4 13a8 8 0 1 0 2.2-5.5" />
      <path d="M4 5v4h4" />
      <path d="M12 8v5l3 2" />
    </Svg>
  );
}

export function IconGlossary() {
  return (
    <Svg>
      <path d="M7 4h10v16H8.5A2.5 2.5 0 0 1 6 17.5V6.5A2.5 2.5 0 0 1 8.5 4" />
      <path d="M10 8h5M10 12h5" />
    </Svg>
  );
}

export function IconSettings() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  );
}

export function IconDrop() {
  return (
    <Svg width="28" height="28" strokeWidth="1.5">
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

export function IconMore() {
  return (
    <Svg>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" />
    </Svg>
  );
}

export function IconStop() {
  return (
    <Svg>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </Svg>
  );
}

export function IconSidebar() {
  return (
    <Svg>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M9 5v14" />
    </Svg>
  );
}

export function IconCheck() {
  return (
    <Svg>
      <path d="m5 13 4 4 10-10" />
    </Svg>
  );
}

export function IconPlay() {
  return (
    <Svg>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPause() {
  return (
    <Svg>
      <rect x="7" y="5" width="3.5" height="14" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconFullscreen() {
  return (
    <Svg>
      <path d="M8 4H4v4" />
      <path d="M16 4h4v4" />
      <path d="M8 20H4v-4" />
      <path d="M16 20h4v-4" />
    </Svg>
  );
}

export function IconFullscreenExit() {
  return (
    <Svg>
      <path d="M8 4v4H4" />
      <path d="M16 4v4h4" />
      <path d="M8 20v-4H4" />
      <path d="M16 20v-4h4" />
    </Svg>
  );
}

export function IconPlus() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconFolder() {
  return (
    <Svg>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H9l2 2h7.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
    </Svg>
  );
}

export function IconResolve() {
  return (
    <Svg>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m10 9 6 3-6 3z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconMute() {
  return (
    <Svg>
      <path d="M4 10v4h3l4 3V7L7 10z" />
      <path d="m16 10 4 4M20 10l-4 4" />
    </Svg>
  );
}

export function IconVolume() {
  return (
    <Svg>
      <path d="M4 10v4h3l4 3V7L7 10z" />
      <path d="M16 9.5a3.2 3.2 0 0 1 0 5" />
      <path d="M18.2 7.5a6 6 0 0 1 0 9" />
    </Svg>
  );
}

export function IconScript() {
  return (
    <Svg>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Svg>
  );
}

export function IconSkipBack() {
  return (
    <Svg>
      <path d="M18 6 10 12l8 6z" fill="currentColor" stroke="none" />
      <path d="M6 6v12" />
    </Svg>
  );
}

export function IconSkipFwd() {
  return (
    <Svg>
      <path d="M6 6v12l8-6z" fill="currentColor" stroke="none" />
      <path d="M18 6v12" />
    </Svg>
  );
}
