import React from 'react';
import { X } from 'lucide-react';

const EventEditModal = ({
  eventEditOpen, selectedEvent, eventEditFields, setEventEditFields,
  eventEditSaving, eventEditError,
  closeEventEdit, saveEventEdit,
}) => {
  if (!eventEditOpen || !selectedEvent) return null;

  return (
    <div className="modal-overlay" onMouseDown={closeEventEdit}>
      <div className="modal" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{selectedEvent?.id === 'new' ? 'New event' : 'Edit event'}</div>
          <button className="btn-ghost btn-icon" onClick={closeEventEdit} title="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <label>Title</label>
            <input value={eventEditFields.summary || ''} onChange={e => setEventEditFields(f => ({ ...f, summary: e.target.value }))} placeholder="Event title" />
          </div>
          <div className="field-row">
            <label>Date</label>
            <input type="date" value={eventEditFields.date || ''} onChange={e => setEventEditFields(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-1)', fontWeight: 500 }}>Time</label>
            <input type="time" value={eventEditFields.startTime || ''} onChange={e => setEventEditFields(f => ({ ...f, startTime: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-0)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: 'var(--text-sm)', fontFamily: 'inherit' }} />
            <input type="time" value={eventEditFields.endTime || ''} onChange={e => setEventEditFields(f => ({ ...f, endTime: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-0)', background: 'var(--bg-0)', color: 'var(--text-0)', fontSize: 'var(--text-sm)', fontFamily: 'inherit' }} />
          </div>
          <div className="field-row">
            <label>Location</label>
            <input value={eventEditFields.location || ''} onChange={e => setEventEditFields(f => ({ ...f, location: e.target.value }))} placeholder="Add location" />
          </div>
          <div className="field-row">
            <label>Description</label>
            <textarea value={eventEditFields.description || ''} onChange={e => setEventEditFields(f => ({ ...f, description: e.target.value }))} placeholder="Add description" style={{ minHeight: '100px' }} />
          </div>
          {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
            <div style={{ marginTop: '4px', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500, marginBottom: '6px', paddingLeft: '84px' }}>
                Attendees
              </div>
              <div style={{ paddingLeft: '84px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {selectedEvent.attendees.map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-1)' }}>{a.name || a.email}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>{a.status === 'accepted' ? 'Accepted' : a.status === 'declined' ? 'Declined' : a.status === 'tentative' ? 'Maybe' : 'Pending'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {eventEditError && <div className="modal-error">{eventEditError}</div>}
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={closeEventEdit} disabled={eventEditSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={saveEventEdit} disabled={eventEditSaving} style={{ fontSize: '13px', padding: '10px 20px' }}>
            {eventEditSaving ? 'Saving...' : selectedEvent?.id === 'new' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventEditModal;
