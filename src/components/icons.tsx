import type { SVGProps } from 'react';

const iconStrokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: '2',
  viewBox: '0 0 24 24',
} satisfies SVGProps<SVGSVGElement>;

export function BookmarkIcon({
  filled = false,
  ...props
}: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg {...iconStrokeProps} fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75v14.19a.5.5 0 0 1-.79.407L12 15.5l-5.21 3.847A.5.5 0 0 1 6 18.94V4.75Z" />
    </svg>
  );
}

export function ChatBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 -960 960 960" {...props}>
      <path d="M68-76.46v-729.23q0-41.03 28.64-69.67T166.31-904h627.38q41.03 0 69.67 28.64T892-805.69v463.38q0 41.03-28.64 69.67T793.69-244H235.54L68-76.46ZM200-330h593.69q4.62 0 8.46-3.85 3.85-3.84 3.85-8.46v-463.38q0-4.62-3.85-8.46-3.84-3.85-8.46-3.85H166.31q-4.62 0-8.46 3.85-3.85 3.84-3.85 8.46v522.08L200-330Zm-46 0v-488 488Z" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ChevronLeftPanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 -960 960 960" {...props}>
      <path d="M432.31-307.31v-345L262.69-480l169.62 172.69ZM520-140h60v-680h-60v680Z" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function HamburgerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function HeartHandsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 -960 960 960" {...props}>
      <path d="M633.85-452.31 475.54-605.46q-28.69-27.69-48.27-61.65-19.58-33.96-19.58-73.97 0-49.55 34.69-84.23Q477.06-860 526.61-860q32.39 0 59.81 15.62 27.43 15.61 47.43 39.77 20-24.16 47.42-39.77Q708.69-860 741.08-860q49.55 0 84.23 34.69Q860-790.63 860-741.08q0 40.01-19.27 73.97t-47.96 61.65L633.85-452.31Zm0-83.53 114.38-110.85q20.15-19.77 35.96-43Q800-712.92 800-741.08q0-24.69-17.12-41.8Q765.77-800 741.08-800q-19 0-34.77 9.92-15.77 9.93-27.85 25.16l-44.61 54.3-44.62-54.3q-12.08-15.23-27.85-25.16-15.76-9.92-34.77-9.92-24.69 0-41.8 17.12-17.12 17.11-17.12 41.8 0 28.16 15.81 51.39t35.96 43l114.39 110.85ZM268.08-216.92l290.3 82.15 238.77-74q-3.07-13.61-12.69-20.88t-21.77-7.27H566.8q-26.18 0-44.49-2-18.31-2-37.62-8.77l-90.3-29.85 17.76-58.77 81 28.16q18.16 6.15 41.93 8.38 23.77 2.23 67.61 2.85 0-14.85-6.69-25.62-6.69-10.77-17.62-14.54l-232.07-85.23q-1.16-.38-2.12-.57-.96-.2-2.11-.2h-74v206.16ZM68.08-100v-383.07h273.54q6.3 0 12.76 1.38 6.47 1.39 12 3.23l233.08 85.85q27.23 10.07 45.23 35.65 18 25.58 18 60.04h100q43.08 0 70.19 27.81Q860-241.31 860-196.92v32.3L560.38-71.54l-292.3-83.38V-100h-200Zm60-60h80v-263.08h-80V-160Zm505.77-550.62Z" />
    </svg>
  );
}

export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M13 16h-1v-4h-1m1-4h.01" />
    </svg>
  );
}

export function NotePenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 -960 960 960" {...props}>
      <path d="M300-172.31v-416q0-29.92 21.5-50.8Q343-660 372.92-660h414.77q29.92 0 51.12 21.19Q860-617.61 860-587.69v299.23L671.54-100H372.31q-29.92 0-51.12-21.19Q300-142.39 300-172.31ZM101-703.08Q95.39-733 112.66-757q17.26-24 47.19-29.61L569.23-859q29.92-5.61 53.92 11.66 24 17.26 29.62 47.19l9.23 52.46h-61.23L593-791.54q-.77-4.23-4.62-6.73-3.84-2.5-8.46-1.73l-409.53 72.77q-5.39.77-8.08 5-2.69 4.23-1.93 9.62l51.93 293.31v178.22q-14.85-7.84-25.39-21.5-10.53-13.65-13.53-31.11L101-703.08Zm259 115.39v415.38q0 5.39 3.46 8.85t8.85 3.46H640v-160h160v-267.69q0-5.39-3.46-8.85t-8.85-3.46H372.31q-5.39 0-8.85 3.46t-3.46 8.85ZM580-380Z" />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SendArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M8 10v8" />
      <path d="M12 10v8" />
      <path d="M16 10v8" />
      <path d="M6 6l1 14h10l1-14" />
    </svg>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconStrokeProps} {...props}>
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
