import { useState } from 'react';
import { ACCT_PALETTE } from '../utils/getAccountColor';

// Brand-safe avatar palette — account identity colors only.
// No SaaS-blue. No teal. No pastels. Mono initials.
const AVATAR_COLORS = ACCT_PALETTE.map(p => p.bg);

function hashString(str) {
  let hash = 0;
  const s = (str || '').toLowerCase();
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getAvatarColor(email) {
  return AVATAR_COLORS[hashString(email) % AVATAR_COLORS.length];
}

function inkForBg(bg) {
  // Match the palette: light colors -> ink, dark colors -> paper
  const slot = ACCT_PALETTE.find(p => p.bg.toLowerCase() === String(bg).toLowerCase());
  return slot ? slot.ink : '#FFFFFF';
}

function getInitial(name, email) {
  const src = name || email || '?';
  const clean = src.replace(/<[^>]*>/g, '').trim();
  return (clean[0] || '?').toUpperCase();
}

/**
 * Avatar component — account-colored disc with mono initial.
 */
export default function Avatar({ src, email, name, size = 32, ring }) {
  const [imgFailed, setImgFailed] = useState(false);

  const color = getAvatarColor(email || name || '');
  const ink = inkForBg(color);
  const initial = getInitial(name, email);

  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: size <= 24 ? '10px' : size <= 32 ? '11px' : size <= 40 ? '13px' : '16px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: ink,
    background: color,
    overflow: 'hidden',
    ...(ring ? { boxShadow: `0 0 0 2px ${ring}` } : {}),
  };

  if (src && !imgFailed) {
    return (
      <div style={style}>
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div style={style}>
      {initial}
    </div>
  );
}
