import React from 'react';
import { Plus, LogOut } from 'lucide-react';
import { getAccountGradient } from '../../utils/helpers';

const AccountMenu = ({
  userProfile,
  connectedAccounts,
  billingPlan, billingLoading,
  handleUpgrade, handleManageBilling,
  handleRemoveAccount, removingAccountId,
  handleAddAccount,
  handleLogout,
  sendDelaySeconds, setSendDelaySeconds,
  avatarDropdownRef, avatarButtonRef,
  avatarDropdownOpen, setAvatarDropdownOpen,
  setRemovingAccountId,
}) => {
  return (
    <div style={{ position: 'relative', marginLeft: '4px' }}>
      <button ref={avatarButtonRef} className="avatar-btn" onClick={() => { setAvatarDropdownOpen(o => !o); setRemovingAccountId(null); }} title="Account menu" aria-label="Account menu" aria-expanded={avatarDropdownOpen} aria-haspopup="true">
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: connectedAccounts.length > 0 ? getAccountGradient(0).gradient : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          {(userProfile?.name || userProfile?.email || '?')[0].toUpperCase()}
        </div>
      </button>
      {avatarDropdownOpen && (
        <div className="avatar-dropdown" ref={avatarDropdownRef}>
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: connectedAccounts.length > 0 ? getAccountGradient(0).gradient : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              {(userProfile?.name || userProfile?.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile?.name || 'User'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile?.email || ''}</div>
            </div>
          </div>
          <div className="avatar-dropdown-divider" />
          <div style={{ padding: '8px 0' }}>
            <div style={{ padding: '4px 16px 8px', fontSize: '11px', fontWeight: 500, color: 'var(--text-3)' }}>Connected accounts</div>
            {connectedAccounts.map((a, idx) => {
              const grad = getAccountGradient(idx);
              return (
                <div key={a.id} className="avatar-dropdown-account-row">
                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: grad.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                    {(a.account_name || a.gmail_email || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.account_name || a.gmail_email}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.gmail_email}</div>
                  </div>
                  {connectedAccounts.length > 1 && (
                    <button onClick={() => handleRemoveAccount(a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: '11px', fontWeight: 500, padding: '4px 8px', borderRadius: 'var(--r-xs)', color: removingAccountId === a.id ? 'var(--danger)' : 'var(--text-3)', transition: 'color var(--t-micro) var(--ease)' }}>
                      {removingAccountId === a.id ? 'Confirm?' : 'Remove'}
                    </button>
                  )}
                </div>
              );
            })}
            <button className="avatar-dropdown-add-btn" onClick={() => { setAvatarDropdownOpen(false); handleAddAccount(); }}><Plus size={14} strokeWidth={1.5} /> Add account</button>
          </div>
          <div className="avatar-dropdown-divider" />
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-1)' }}>Plan</span>
              <span className={`plan-badge ${billingPlan}`}>{billingPlan === 'pro' ? 'Pro' : 'Free'}</span>
            </div>
            {billingPlan === 'pro' ? (
              <button onClick={handleManageBilling} disabled={billingLoading} style={{ background: 'transparent', border: '1px solid var(--line-0)', borderRadius: 'var(--r-xs)', color: 'var(--text-1)', fontSize: '12px', fontWeight: 500, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Manage</button>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => handleUpgrade('monthly')} disabled={billingLoading} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-0)', borderRadius: 'var(--r-xs)', color: 'var(--text-1)', fontSize: '11px', fontWeight: 500, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>$15/mo</button>
                <button onClick={() => handleUpgrade('annual')} disabled={billingLoading} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--r-xs)', color: '#fff', fontSize: '11px', fontWeight: 500, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>$144/yr</button>
              </div>
            )}
          </div>
          <div className="avatar-dropdown-divider" />
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-3)', marginBottom: 6 }}>Undo send</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 5, 10, 30].map(s => (
                <button key={s} onClick={() => setSendDelaySeconds(s)}
                  className={`ev-filter-btn${sendDelaySeconds === s ? ' active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: 11 }}>
                  {s === 0 ? 'Off' : `${s}s`}
                </button>
              ))}
            </div>
          </div>
          <div className="avatar-dropdown-divider" />
          <button className="avatar-dropdown-signout" onClick={() => { setAvatarDropdownOpen(false); handleLogout(); }}><LogOut size={14} strokeWidth={1.5} /> Sign out</button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
