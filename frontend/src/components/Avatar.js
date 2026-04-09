import { useState } from 'react';

// Deterministic color from email string
const AVATAR_COLORS = [
  '#1A73E8', '#D93025', '#188038', '#E37400',
  '#A142F4', '#E8453C', '#1E8E3E', '#F29900',
  '#8430CE', '#C5221F', '#0D652D', '#EA8600',
  '#6200EA', '#B31412', '#137333', '#F9AB00',
];

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

function getInitial(name, email) {
  const src = name || email || '?';
  // Strip display name formatting
  const clean = src.replace(/<[^>]*>/g, '').trim();
  return (clean[0] || '?').toUpperCase();
}

/**
 * Avatar component.
 * Props:
 *   src   - direct image URL (Google profile pic)
 *   email - used for color/initial derivation
 *   name  - display name for initial
 *   size  - 24 | 32 | 40 | 56 (default 32)
 *   ring  - optional CSS color for the ring border
 */
export default function Avatar({ src, email, name, size = 32, ring }) {
  const [imgFailed, setImgFailed] = useState(false);

  const color = getAvatarColor(email || name || '');
  const initial = getInitial(name, email);

  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size <= 24 ? '10px' : size <= 32 ? '12px' : size <= 40 ? '14px' : '18px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.92)',
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
