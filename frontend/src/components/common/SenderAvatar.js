import { useState } from 'react';
import { getSenderColor, getSenderInitial, getSenderLogoUrl, markLogoFailed } from '../../utils/helpers';

export default function SenderAvatar({ from, size = 32, className = '' }) {
  const logoUrl = getSenderLogoUrl(from);
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass = size <= 24 ? 'sender-avatar-sm' : '';
  const initial = getSenderInitial(from);
  const color = getSenderColor(from);

  if (logoUrl && !imgFailed) {
    return (
      <div className={`sender-avatar ${sizeClass} ${className}`} style={{ background: color, overflow: 'hidden', padding: 0 }}>
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          onError={() => { markLogoFailed(from); setImgFailed(true); }}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`sender-avatar ${sizeClass} ${className}`} style={{ background: color }}>
      {initial}
    </div>
  );
}
