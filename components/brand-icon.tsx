type BrandIconProps = {
  className?: string;
  id?: string;
  title?: string;
};

export function BrandIcon({ className, id = "chocolate-donut-planet", title }: BrandIconProps) {
  if (id.startsWith("reference-donut")) {
    return (
      <svg className={className} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
        {title && <title>{title}</title>}
        <defs>
          <filter id={`${id}-soft-shadow`} x="-25%" y="-25%" width="150%" height="155%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#7a4a34" floodOpacity=".2" />
          </filter>
        </defs>
        <g transform="rotate(10 32 35)" filter={`url(#${id}-soft-shadow)`}>
          <path
            d="M7.8 39.1C6.4 28.9 17.1 18.7 31.9 16.3c16.3-2.6 28.2 4.3 29.6 15.5 1.3 10.8-10.1 18.7-25.4 20.4C20.4 53.9 9.2 49.2 7.8 39.1Z"
            fill="none"
            opacity=".2"
            stroke="#a96c4e"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="7.6"
            transform="translate(0 1.5)"
          />
          <path
            d="M24.4 32.4c-.4-4.1 3.7-7.4 9.3-7.8 6-.4 10.6 2.2 11 6.2.4 4.1-3.8 7.4-9.8 7.8-5.9.4-10.1-2.1-10.5-6.2Z"
            fill="none"
            opacity=".16"
            stroke="#a96c4e"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5.4"
            transform="translate(0 .9)"
          />
          <path
            d="M7.8 39.1C6.4 28.9 17.1 18.7 31.9 16.3c16.3-2.6 28.2 4.3 29.6 15.5 1.3 10.8-10.1 18.7-25.4 20.4C20.4 53.9 9.2 49.2 7.8 39.1Z"
            fill="none"
            stroke="#fffdf8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="6.3"
          />
          <path
            d="M24.4 32.4c-.4-4.1 3.7-7.4 9.3-7.8 6-.4 10.6 2.2 11 6.2.4 4.1-3.8 7.4-9.8 7.8-5.9.4-10.1-2.1-10.5-6.2Z"
            fill="none"
            stroke="#fffdf8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4.9"
          />
          <path d="M13.3 31.7c3.9-6.1 12.2-10.4 22.7-10.5 7.6-.1 14.2 2.2 18 6.3" fill="none" opacity=".7" stroke="#fffdf8" strokeLinecap="round" strokeWidth="2.1" />
          <path d="M13.8 44.2c6.5 4.3 18.9 5.8 31.2 1.1" fill="none" opacity=".58" stroke="#fffdf8" strokeLinecap="round" strokeWidth="1.9" />
        </g>
      </svg>
    );
  }

  const doughId = `${id}-dough`;
  const chocoId = `${id}-choco`;
  const shadowId = `${id}-shadow`;
  const ringClipId = `${id}-ring-clip`;
  const holeId = `${id}-hole`;

  return (
    <svg className={className} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={doughId} x1="11" y1="14" x2="54" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f9e2b4" />
          <stop offset=".54" stopColor="#e8bd7d" />
          <stop offset="1" stopColor="#d39a62" />
        </linearGradient>
        <linearGradient id={chocoId} x1="12" y1="14" x2="52" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a67652" />
          <stop offset=".6" stopColor="#8b5a3c" />
          <stop offset="1" stopColor="#67432f" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#67432f" floodOpacity=".18" />
        </filter>
        <clipPath id={ringClipId}>
          <path d="M9.8 34.7C9.2 25.8 19.4 18 31.5 17.2c13.4-.8 23.1 6.3 23.5 15.1.4 9-9.1 15.4-21.8 16.4C20.3 49.7 10.5 43.8 9.8 34.7Z" />
        </clipPath>
        <mask id={holeId}>
          <rect width="64" height="64" fill="#fff" />
          <path d="M24.8 34.6c-.2-3.4 3.1-6.2 7.6-6.4 4.7-.2 8.2 2.1 8.5 5.6.2 3.6-3.2 6.3-7.9 6.5-4.7.3-8-2.1-8.2-5.7Z" fill="#000" />
        </mask>
      </defs>
      <g transform="rotate(-8 32 34)">
        <path
          d="M5.8 34.6C15 25.2 49.4 22.4 59.1 30.5"
          fill="none"
          stroke="#fff8ec"
          strokeDasharray="1.2 4"
          strokeLinecap="round"
          strokeWidth="1.45"
          opacity=".62"
        />
      </g>
      <g filter={`url(#${shadowId})`}>
        <g transform="rotate(-11 32 34)" mask={`url(#${holeId})`}>
          <path
            d="M9.8 34.7C9.2 25.8 19.4 18 31.5 17.2c13.4-.8 23.1 6.3 23.5 15.1.4 9-9.1 15.4-21.8 16.4C20.3 49.7 10.5 43.8 9.8 34.7Z"
            fill={`url(#${doughId})`}
          />
          <path
            d="M8.8 24.8c4.7-6.8 13-10.4 22.8-10.9 11.8-.6 21.5 3.8 23.8 11.7-4.2 5.2-8 1.2-12.1 4.4-4.7 3.6-7.4 8.3-12 4.3-4.5-3.9-7.5 2.9-12.2 1.6-4.3-1.1-6-6.5-10.3-11.1Z"
            clipPath={`url(#${ringClipId})`}
            fill={`url(#${chocoId})`}
          />
          <path
            d="M18.4 23.8c4.9-2.7 13.4-4.4 21.5-2.9"
            clipPath={`url(#${ringClipId})`}
            fill="none"
            opacity=".22"
            stroke="#fff8ec"
            strokeLinecap="round"
            strokeWidth="2.6"
          />
          <circle cx="21.2" cy="27.5" r="1" fill="#fff8ec" opacity=".88" />
          <circle cx="44.7" cy="31.2" r=".85" fill="#fff8ec" opacity=".62" />
          <rect x="35.3" y="23.4" width="4.8" height="1.7" rx=".85" fill="#ffde96" opacity=".9" transform="rotate(-18 37.7 24.25)" />
          <rect x="18.8" y="31.2" width="4.3" height="1.6" rx=".8" fill="#62c4da" opacity=".72" transform="rotate(28 20.95 32)" />
        </g>
      </g>
      <g transform="rotate(-8 32 34)">
        <path
          d="M6.1 34.7C14.8 44 49.3 47.1 59 38.9"
          fill="none"
          opacity=".76"
          stroke="#fff8ec"
          strokeLinecap="round"
          strokeWidth="1.75"
        />
      </g>
    </svg>
  );
}
