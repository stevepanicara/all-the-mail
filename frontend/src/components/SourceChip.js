import React from 'react';
import { getAccountShortLabel } from '../utils/getAccountShortLabel';
import { getAccountColor } from '../utils/getAccountColor';
import './SourceChip.css';

/**
 * SourceChip — Account badge (JetBrains Mono 9.5, pill, account-color).
 *
 * @param {Object}   props
 * @param {string}   props.accountName   Full account display name (for label + tooltip)
 * @param {string}   [props.accountId]   Account ID / email (for color hashing + click)
 * @param {Array}    [props.accounts]    Full connectedAccounts list — lets us pick color by index
 * @param {'wash'|'solid'|'outline'|'dot'} [props.variant='wash']
 * @param {Function} [props.onClick]
 */
const SourceChip = ({
  accountName,
  accountId,
  accounts,
  variant = 'wash',
  onClick,
}) => {
  const label = getAccountShortLabel(accountName);
  if (!label && variant !== 'dot') return null;

  const color = getAccountColor(accountId || accountName, accounts);

  const handleClick = (e) => {
    if (onClick) {
      e.stopPropagation();
      onClick(accountId);
    }
  };

  const styleByVariant = {
    wash:    { background: color.wash, color: color.inkLabel, border: 'none' },
    solid:   { background: color.bg,   color: color.ink,      border: 'none' },
    outline: { background: 'transparent', color: 'var(--ink-1)', border: '1px solid var(--ink-5)' },
    dot:     { background: color.bg,   width: 6, height: 6, padding: 0 },
  };

  if (variant === 'dot') {
    return (
      <span
        className={`source-chip source-chip--dot ${onClick ? 'source-chip--clickable' : ''}`}
        style={styleByVariant.dot}
        onClick={handleClick}
        title={accountName}
        aria-label={`From ${accountName}`}
      />
    );
  }

  return (
    <span
      className={`source-chip source-chip--${variant} ${onClick ? 'source-chip--clickable' : ''}`}
      style={styleByVariant[variant] || styleByVariant.wash}
      onClick={handleClick}
      title={accountName}
      aria-label={`From ${accountName}`}
    >
      {label}
    </span>
  );
};

export default SourceChip;
