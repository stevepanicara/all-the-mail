import React from 'react';
import { getAccountShortLabel } from '../utils/getAccountShortLabel';
import './SourceChip.css';

/**
 * SourceChip - Account badge for email rows
 * 
 * Shows which account an email came from (Everything view only)
 * 
 * @param {Object} props
 * @param {string} props.accountName - Full account display name
 * @param {string} props.accountId - Account ID (for click handling)
 * @param {'pill'|'dot'} [props.variant='pill'] - Visual style
 * @param {Function} [props.onClick] - Optional click handler
 */
const SourceChip = ({ 
  accountName, 
  accountId,
  variant = 'pill',
  onClick 
}) => {
  // Generate short label from account name
  const label = getAccountShortLabel(accountName);

  // Don't render if no label
  if (!label) return null;

  const handleClick = (e) => {
    if (onClick) {
      e.stopPropagation(); // Don't trigger email selection
      onClick(accountId);
    }
  };

  return (
    <span
      className={`source-chip source-chip--${variant} ${onClick ? 'source-chip--clickable' : ''}`}
      onClick={handleClick}
      title={accountName} // Full name on hover
      aria-label={`From ${accountName}`}
    >
      {label}
    </span>
  );
};

export default SourceChip;
