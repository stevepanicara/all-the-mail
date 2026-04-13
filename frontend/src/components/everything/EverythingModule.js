import React from 'react';
import { Mail, FileText, Calendar, Plus } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { getAccountGradient, getDocIcon, formatRelativeEdit, formatTime, stripName } from '../../utils/helpers';

const EverythingModule = ({
  evFilteredEmails, evFilteredDocs, evFilteredEvents, filteredAllEvents,
  evMailFilter, setEvMailFilter,
  evDocsFilter, setEvDocsFilter,
  evCalsFilter, setEvCalsFilter,
  evMobileTab, setEvMobileTab,
  mobileUnifiedFeed,
  connectedAccounts,
  activeView,
  slideOverEmail, openSlideOverEmail, closeSlideOver,
  slideOverDoc, openSlideOverDoc,
  isLoadingDocs, isLoadingEvents,
  hasDocsError, hasEventsError,
  anyHasDocs, anyHasCals,
  openEventEdit,
  setSelectedEvent,
  handleAddAccount,
  cascadeTimestampRef,
  cascadeKey,
}) => {
  return (
    <div className="ev-everything-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="ev-mobile-tabs">
        <button className={`ev-filter-btn${evMobileTab === 'all' ? ' active' : ''}`} onClick={() => setEvMobileTab('all')}>All</button>
        <button className={`ev-filter-btn${evMobileTab==='mail'?' active':''}`} onClick={()=>setEvMobileTab('mail')}>Mail</button>
        <button className={`ev-filter-btn${evMobileTab==='docs'?' active':''}`} onClick={()=>setEvMobileTab('docs')}>Docs</button>
        <button className={`ev-filter-btn${evMobileTab==='cals'?' active':''}`} onClick={()=>setEvMobileTab('cals')}>Cals</button>
      </div>
      <PanelGroup orientation="horizontal" id="atm-everything-layout" className={`ev-desktop-only${evMobileTab === 'all' ? ' ev-hide-on-mobile' : ''}`}>
        <Panel defaultSize="40%" minSize="30%" id="ev-mail">
          <div className={`ev-column${evMobileTab === 'mail' ? ' ev-mobile-active' : ''}`}>
            <div className="ev-col-header">
              <span className="ev-col-title">Mail</span>
              <div className="ev-col-filters">
                <button className={`ev-filter-btn${evMailFilter==='all'?' active':''}`} onClick={()=>setEvMailFilter('all')}>All</button>
                <button className={`ev-filter-btn${evMailFilter==='unread'?' active':''}`} onClick={()=>setEvMailFilter('unread')}>Unread</button>
              </div>
            </div>
            <div className="ev-col-body">
              {evFilteredEmails.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}><Mail size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No messages</div></div>
              ) : (
                evFilteredEmails.slice(0, 50).map((email, idx) => {
                  const accountIndex = connectedAccounts.findIndex(a => a.id === email.accountId);
                  const grad = accountIndex !== -1 ? getAccountGradient(accountIndex) : null;
                  const isCascading = cascadeTimestampRef ? (Date.now() - cascadeTimestampRef.current) < 1200 : false;
                  const cc = isCascading && idx <= 23 ? ' row--intro' : '';
                  const cs = isCascading && idx <= 23 ? { '--d': `${Math.min(idx, 23) * 36}ms` } : {};
                  return (
                    <div key={`ev-${email.id}:${cascadeKey}`} className={`email-item${cc}`} onClick={() => openSlideOverEmail(email, idx)}
                      style={{ position: 'relative', padding: '0 16px', minHeight: '48px', ...cs }}>
                      {!email.isRead && grad && <span className="unread-marker" style={{ background: grad.gradient }} />}
                      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 72px', gap: '0 10px', alignItems: 'center', width: '100%', minWidth: 0 }}>
                        <div className="row-icon-slot" style={{ width: 24 }}>{grad && <span className="account-dot" style={{ background: grad.gradient, width: 8, height: 8 }} />}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', minWidth: 0 }}>
                            <span className="row-sender" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-1)', flexShrink: 0, maxWidth: '140px' }}>{stripName(email.from || '')}</span>
                            <span className="row-subject" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-2)' }}>{email.subject || '(no subject)'}</span>
                          </div>
                        </div>
                        <span className="row-time">{formatTime(email.date)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="ev-column-divider ev-column-divider--mail-docs" />
        <Panel defaultSize="30%" minSize="22%" id="ev-docs">
          <div className={`ev-column${evMobileTab === 'docs' ? ' ev-mobile-active' : ''}`}>
            <div className="ev-col-header">
              <span className="ev-col-title">Docs</span>
              <div className="ev-col-filters">
                <button className={`ev-filter-btn${evDocsFilter==='recent'?' active':''}`} onClick={()=>setEvDocsFilter('recent')}>Recent</button>
                <button className={`ev-filter-btn${evDocsFilter==='shared'?' active':''}`} onClick={()=>setEvDocsFilter('shared')}>Shared</button>
              </div>
            </div>
            <div className="ev-col-body">
              {isLoadingDocs && evFilteredDocs.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (<div className="skeleton-row" key={`edsk-${i}`} style={{ minHeight: 48, padding: '12px 16px' }}><div className="skeleton-block" style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} /><div className="skeleton-block" style={{ flex: 1 }} /></div>))
              ) : (!anyHasDocs || hasDocsError) && evFilteredDocs.length === 0 ? (
                <div className="connect-cta-compact">
                  <FileText size={24} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{anyHasDocs ? 'Drive permissions need updating' : 'Connect Google Drive'}</div>
                  {anyHasDocs && <div style={{ fontSize: '11px', color: 'var(--text-3)', maxWidth: 200, textAlign: 'center' }}>Re-grant Drive access to restore your documents</div>}
                  <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '11px', padding: '4px 10px' }}><Plus size={12} strokeWidth={1.5} /> {anyHasDocs ? 'Re-authorize' : 'Connect'}</button>
                </div>
              ) : evFilteredDocs.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}><FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No documents</div></div>
              ) : evFilteredDocs.map((doc, idx) => {
                const isCascading = cascadeTimestampRef ? (Date.now() - cascadeTimestampRef.current) < 1200 : false;
                const cc = isCascading && idx <= 23 ? ' row--intro' : '';
                const cs = isCascading && idx <= 23 ? { '--d': `${Math.min(idx + 8, 23) * 36}ms` } : {};
                const EvDocIcon = getDocIcon(doc.mimeType);
                return (
                  <div key={doc.id} className={`email-item${cc}`} onClick={() => openSlideOverDoc(doc, idx)} style={{ padding: '10px 16px', minHeight: '48px', cursor: 'pointer', ...cs }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: '0 10px', alignItems: 'center' }}>
                      <div className="row-icon-slot" style={{ width: 24 }}><EvDocIcon size={14} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '1px' }}>{doc.owner} · {formatRelativeEdit(doc.lastEdited)}</div>
                      </div>
                      <span className="row-time">{new Date(doc.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="ev-column-divider ev-column-divider--docs-cals" />
        <Panel defaultSize="30%" minSize="22%" id="ev-cals">
          <div className={`ev-column${evMobileTab === 'cals' ? ' ev-mobile-active' : ''}`}>
            <div className="ev-col-header">
              <span className="ev-col-title">Cals</span>
              <div className="ev-col-filters">
                <button className={`ev-filter-btn${evCalsFilter==='upcoming'?' active':''}`} onClick={()=>setEvCalsFilter('upcoming')}>Upcoming</button>
                <button className={`ev-filter-btn${evCalsFilter==='week'?' active':''}`} onClick={()=>setEvCalsFilter('week')}>Week</button>
              </div>
            </div>
            <div className="ev-col-body">
              {(() => {
                const grouped = {};
                evFilteredEvents.forEach(ev => { if (!grouped[ev.day]) grouped[ev.day] = []; grouped[ev.day].push(ev); });
                if (isLoadingEvents && evFilteredEvents.length === 0) return Array.from({ length: 4 }).map((_, i) => (<div className="skeleton-row" key={`ecsk-${i}`} style={{ minHeight: 48, padding: '12px 16px' }}><div className="skeleton-block" style={{ width: 3, height: 28, borderRadius: 2, flexShrink: 0 }} /><div className="skeleton-block" style={{ width: 40 }} /><div className="skeleton-block" style={{ flex: 1 }} /></div>));
                if ((!anyHasCals || hasEventsError) && evFilteredEvents.length === 0) return (
                  <div className="connect-cta-compact">
                    <Calendar size={24} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{anyHasCals ? 'Calendar permissions need updating' : 'Connect Google Calendar'}</div>
                    {anyHasCals && <div style={{ fontSize: '11px', color: 'var(--text-3)', maxWidth: 200, textAlign: 'center' }}>Re-grant Calendar access to restore your events</div>}
                    <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '11px', padding: '4px 10px' }}><Plus size={12} strokeWidth={1.5} /> {anyHasCals ? 'Re-authorize' : 'Connect'}</button>
                  </div>
                );
                return evFilteredEvents.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}><Calendar size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No events</div></div>
                ) : Object.entries(grouped).map(([day, dayEvents]) => (
                  <div key={day}>
                    <div className="cal-day-header">{day}</div>
                    {dayEvents.map((ev, idx) => {
                      const isCascading = cascadeTimestampRef ? (Date.now() - cascadeTimestampRef.current) < 1200 : false;
                      const globalIdx = idx + 16;
                      const cc = isCascading && globalIdx <= 23 ? ' row--intro' : '';
                      const cs = isCascading && globalIdx <= 23 ? { '--d': `${Math.min(globalIdx, 23) * 36}ms` } : {};
                      return (
                        <div key={ev.id} className={`cal-event${cc}`} onClick={() => { setSelectedEvent(ev); openEventEdit(ev); }} style={cs}>
                          <div className="cal-event-marker" style={ev.calendarColor ? { background: ev.calendarColor } : ev.urgent ? { background: 'var(--warm-0)' } : undefined} />
                          <div className="cal-event-time">{ev.time}</div>
                          <div style={{ flex: 1, minWidth: 0 }}><div className="cal-event-title">{ev.title}</div><div className="cal-event-meta">{ev.meta}</div></div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
        </Panel>
      </PanelGroup>
      <div className={`ev-mobile-unified-wrap${evMobileTab === 'all' ? ' active' : ''}`}>
        <div className="ev-col-header">
          <span className="ev-col-title">Everything</span>
        </div>
        <div className="ev-col-body">
          {mobileUnifiedFeed.map((item, i) => {
            if (item.type === 'email') {
              const email = item.data;
              const accountIndex = connectedAccounts.findIndex(a => a.id === email.accountId);
              const grad = accountIndex !== -1 ? getAccountGradient(accountIndex) : null;
              return (
                <div key={`em-${email.id}-${i}`} className="ev-feed-item ev-feed-email" onClick={() => openSlideOverEmail(email)}>
                  <div className="ev-feed-icon"><Mail size={14} strokeWidth={1.5} /></div>
                  <div className="ev-feed-content">
                    <div className="ev-feed-line1">
                      <span className="ev-feed-title">{stripName(email.from || '')}</span>
                      {grad && <span className="ev-feed-source-dot" style={{ background: grad.gradient }} />}
                    </div>
                    <div className="ev-feed-line2">{email.subject || '(no subject)'}</div>
                  </div>
                  <span className="ev-feed-time">{formatTime(email.date)}</span>
                </div>
              );
            }
            if (item.type === 'doc') {
              const doc = item.data;
              return (
                <div key={`dc-${doc.id}-${i}`} className="ev-feed-item ev-feed-doc" onClick={() => openSlideOverDoc(doc)}>
                  <div className="ev-feed-icon"><FileText size={14} strokeWidth={1.5} /></div>
                  <div className="ev-feed-content">
                    <div className="ev-feed-line1">
                      <span className="ev-feed-title">{doc.title}</span>
                    </div>
                    <div className="ev-feed-line2">{doc.owner} · {formatRelativeEdit(doc.lastEdited)}</div>
                  </div>
                  <span className="ev-feed-time">{new Date(doc.date || doc.lastEdited).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              );
            }
            const ev = item.data;
            return (
              <div key={`cv-${ev.id}-${i}`} className="ev-feed-item ev-feed-event" onClick={() => { setSelectedEvent(ev); openEventEdit(ev); }}>
                <div className="ev-feed-icon"><Calendar size={14} strokeWidth={1.5} /></div>
                <div className="ev-feed-content">
                  <div className="ev-feed-line1">
                    <span className="ev-feed-title">{ev.title}</span>
                  </div>
                  <div className="ev-feed-line2">{ev.day} · {ev.time}{ev.meta ? ` · ${ev.meta}` : ''}</div>
                </div>
              </div>
            );
          })}
          {mobileUnifiedFeed.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-title">Nothing to show</div>
              <div className="empty-state-subtitle">Connect an account to see your activity</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EverythingModule;
