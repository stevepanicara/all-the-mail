import React from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar, Clock, MapPin, ExternalLink,
} from 'lucide-react';

const CalsModule = ({
  connectedAccounts,
  filteredAllEvents,
  calGridDays, calMonthDays,
  calDate, setCalDate,
  calsViewMode, setCalsViewMode,
  calTitle,
  calNavigate,
  selectedEvent, setSelectedEvent,
  openEventEdit,
  isLoadingEvents,
  hasEventsError,
  anyHasCals,
  handleAddAccount,
}) => {
  const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm
  const grouped = {};
  filteredAllEvents.forEach(ev => { if (!grouped[ev.day]) grouped[ev.day] = []; grouped[ev.day].push(ev); });

  const renderEventChip = (ev) => (
    <div key={ev.id} className={`gcal-chip${selectedEvent?.id === ev.id ? ' active' : ''}`}
      role="button" tabIndex={0} aria-pressed={selectedEvent?.id === ev.id}
      aria-label={`${ev.title}${ev.time && ev.time !== 'All day' ? `, ${ev.time}` : ', All day'}`}
      style={{ borderLeftColor: ev.calendarColor || 'var(--accent)', background: ev.calendarColor ? `${ev.calendarColor}18` : 'var(--accent-weak)' }}
      onClick={() => setSelectedEvent(prev => prev?.id === ev.id ? null : ev)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedEvent(prev => prev?.id === ev.id ? null : ev)}>
      <span className="gcal-chip-time">{ev.time !== 'All day' ? ev.time : ''}</span>
      <span className="gcal-chip-title">{ev.title}</span>
    </div>
  );

  const renderDayGrid = (days) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    return (
      <div className="gcal-grid" role="grid" aria-label="Calendar" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        {/* Header row */}
        <div className="gcal-corner" />
        {days.map(day => (
          <div key={day.label} className={`gcal-col-header${day.isToday ? ' gcal-today' : ''}`}>
            <span className="gcal-col-weekday">{day.shortLabel}</span>
            <span className={`gcal-col-daynum${day.isToday ? ' gcal-today-num' : ''}`}>{day.dayNum}</span>
          </div>
        ))}
        {/* All-day row */}
        <div className="gcal-time-label gcal-allday-label">all-day</div>
        {days.map(day => (
          <div key={`ad-${day.label}`} className="gcal-allday-cell">
            {day.events.filter(ev => ev.time === 'All day').map(renderEventChip)}
          </div>
        ))}
        {/* Time grid */}
        {HOURS.map(h => (
          <React.Fragment key={h}>
            <div className="gcal-time-label">{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</div>
            {days.map(day => {
              const hourEvents = day.events.filter(ev => {
                if (ev.time === 'All day') return false;
                const evDate = new Date(ev.startISO || 0);
                return evDate.getHours() === h;
              });
              return (
                <div key={`${h}-${day.label}`} className="gcal-cell">
                  {hourEvents.map(renderEventChip)}
                  {h === currentHour && day.isToday && (
                    <div className="gcal-now-line" style={{ top: `${(currentMinutes / 60) * 48}px` }} />
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const isGridView = calsViewMode === 'day' || calsViewMode === 'week' || calsViewMode === '4day';

  return (
    <div className="gcal-root">
      {/* Toolbar */}
      <div className="gcal-toolbar">
        <div className="gcal-toolbar-left">
          <button className="btn-ghost gcal-toolbar-btn" onClick={() => {
            const calsAccount = connectedAccounts.find(a => a.granted_scopes?.includes('cals'));
            if (!calsAccount) return;
            const now = new Date();
            const oneHourLater = new Date(now.getTime() + 3600000);
            setSelectedEvent({ id: 'new', accountId: calsAccount.id, title: '', description: '', meta: '', startISO: now.toISOString(), endISO: oneHourLater.toISOString() });
            openEventEdit({ id: 'new', accountId: calsAccount.id, title: '', description: '', meta: '', startISO: now.toISOString(), endISO: oneHourLater.toISOString() });
          }}><Plus size={14} strokeWidth={1.5} /> New event</button>
          <div className="gcal-nav-group" role="group" aria-label="Calendar navigation">
            <button className="btn-ghost gcal-toolbar-today" onClick={() => setCalDate(new Date())} aria-label="Go to today">Today</button>
            <button className="gcal-nav-btn" onClick={() => calNavigate(-1)} aria-label="Previous period"><ChevronLeft size={16} strokeWidth={1.5} /></button>
            <button className="gcal-nav-btn" onClick={() => calNavigate(1)} aria-label="Next period"><ChevronRight size={16} strokeWidth={1.5} /></button>
          </div>
          <span className="gcal-title">{calTitle}</span>
        </div>
        <div className="gcal-toolbar-right" role="group" aria-label="Calendar view">
          {['day', 'week', 'month', 'year', 'schedule', '4day'].map(v => (
            <button key={v} className={`ev-filter-btn${calsViewMode === v ? ' active' : ''}`}
              onClick={() => setCalsViewMode(v)} aria-pressed={calsViewMode === v}>
              {v === '4day' ? '4 days' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="gcal-body">
        {(!anyHasCals || hasEventsError) && filteredAllEvents.length === 0 ? (
          <div className="connect-cta">
            <Calendar size={32} strokeWidth={1.5} className="connect-cta-icon" />
            <div className="connect-cta-title">{anyHasCals ? 'Calendar permissions need updating' : 'Connect Google Calendar'}</div>
            <div className="connect-cta-subtitle">{anyHasCals ? 'Re-grant Calendar access to restore your events.' : 'Grant Calendar permissions to see your events here'}</div>
            <button className="btn-ghost connect-cta-btn" onClick={handleAddAccount}><Plus size={14} strokeWidth={1.5} /> {anyHasCals ? 'Re-authorize Calendar' : 'Connect account'}</button>
          </div>
        ) : isGridView ? (
          renderDayGrid(calGridDays)
        ) : calsViewMode === 'month' ? (
          <div className="gcal-month">
            <div className="gcal-month-header">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="gcal-month-weekday">{d}</div>
              ))}
            </div>
            {calMonthDays.map((week, wi) => (
              <div key={wi} className="gcal-month-row" role="row">
                {week.map((day, di) => (
                  <div key={di} role="gridcell" aria-label={day.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + (day.events.length ? `, ${day.events.length} event${day.events.length !== 1 ? 's' : ''}` : '')}
                    className={`gcal-month-cell${day.isToday ? ' gcal-today' : ''}${!day.isCurrentMonth ? ' gcal-muted' : ''}`}
                    onClick={() => { setCalDate(day.date); setCalsViewMode('day'); }}>
                    <span className={`gcal-month-daynum${day.isToday ? ' gcal-today-num' : ''}`}>{day.dayNum}</span>
                    {day.events.slice(0, 3).map(renderEventChip)}
                    {day.events.length > 3 && <div className="gcal-more">+{day.events.length - 3} more</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : calsViewMode === 'year' ? (
          <div className="gcal-year">
            {Array.from({ length: 12 }, (_, mi) => {
              const monthDate = new Date(calDate.getFullYear(), mi, 1);
              const monthName = monthDate.toLocaleDateString(undefined, { month: 'long' });
              const monthEvents = filteredAllEvents.filter(ev => {
                const d = new Date(ev.startISO || 0);
                return d.getFullYear() === calDate.getFullYear() && d.getMonth() === mi;
              });
              return (
                <div key={mi} className="gcal-year-month" onClick={() => { setCalDate(monthDate); setCalsViewMode('month'); }}>
                  <div className="gcal-year-month-name">{monthName}</div>
                  <div className="gcal-year-month-count">{monthEvents.length > 0 ? `${monthEvents.length} event${monthEvents.length !== 1 ? 's' : ''}` : ''}</div>
                </div>
              );
            })}
          </div>
        ) : /* schedule */ (
          <div className="gcal-schedule-scroll">
            {isLoadingEvents && filteredAllEvents.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (<div className="skeleton-row" key={`esk-${i}`} style={{ minHeight: 48 }}><div className="skeleton-block" style={{ width: 3, height: 36, borderRadius: 2, flexShrink: 0 }} /><div className="skeleton-block" style={{ width: 48 }} /><div className="skeleton-block" style={{ flex: 1 }} /></div>))
            ) : Object.keys(grouped).length === 0 ? (
              <div className="gcal-schedule-empty"><Calendar size={28} className="gcal-schedule-empty-icon" /><div className="gcal-schedule-empty-text">No events</div></div>
            ) : Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day}>
                <div className="cal-day-header">{day}</div>
                {dayEvents.map(ev => (
                  <div key={ev.id} className={`cal-event${selectedEvent?.id === ev.id ? ' active' : ''}`} onClick={() => setSelectedEvent(ev)}>
                    <div className="cal-event-marker" style={ev.calendarColor ? { background: ev.calendarColor } : ev.urgent ? { background: 'var(--warm-0)' } : undefined} />
                    <div className="cal-event-time">{ev.time}</div>
                    <div className="cal-event-content">
                      <div className="cal-event-title">{ev.title}</div>
                      <div className="cal-event-meta">{ev.calendarName && ev.calendarName !== 'primary' ? `${ev.calendarName}${ev.meta ? ' · ' : ''}` : ''}{ev.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event detail slide-out */}
      {selectedEvent && (
        <div className="gcal-detail">
          <button className="slide-over-close" onClick={() => setSelectedEvent(null)} aria-label="Close event detail"><X size={16} strokeWidth={1.5} /></button>
          <div className="gcal-detail-body">
            <div className="gcal-detail-header">
              <div className="gcal-detail-marker" style={selectedEvent.calendarColor ? { background: selectedEvent.calendarColor } : selectedEvent.urgent ? { background: 'var(--warm-0)' } : undefined} />
              <h2 className="gcal-detail-title">{selectedEvent.title}</h2>
            </div>
            <div className="gcal-detail-time">
              <div className="gcal-detail-time-row">
                <Clock size={13} strokeWidth={1.5} className="gcal-detail-time-icon" />
                {selectedEvent.day} · {selectedEvent.time}{selectedEvent.endTime ? ` – ${selectedEvent.endTime}` : ''}
              </div>
              {selectedEvent.meta && (
                <div className="gcal-detail-time-row">
                  <MapPin size={13} strokeWidth={1.5} className="gcal-detail-time-icon" />
                  {selectedEvent.meta}
                </div>
              )}
            </div>
            <div className="gcal-detail-actions">
              <button className="btn-ghost-sm" onClick={() => openEventEdit(selectedEvent)}>Edit</button>
              {selectedEvent.htmlLink && <button className="btn-ghost-sm" onClick={() => window.open(selectedEvent.htmlLink, '_blank', 'noopener,noreferrer')}><ExternalLink size={13} strokeWidth={1.5} /> Google</button>}
            </div>
            {selectedEvent.attendees?.length > 0 && (
              <div className="gcal-detail-attendees">
                <div className="gcal-detail-attendees-label">Attendees</div>
                {selectedEvent.attendees.map((a, i) => (
                  <div key={i} className="gcal-detail-attendee-row">
                    <span className="gcal-detail-attendee-name">{a.name || a.email}</span>
                    <span className="gcal-detail-attendee-status">{a.status === 'accepted' ? 'Yes' : a.status === 'declined' ? 'No' : a.status === 'tentative' ? 'Maybe' : '?'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalsModule;
