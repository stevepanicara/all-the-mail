import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EventEditModal from './EventEditModal';

const defaultProps = {
  eventEditOpen: true,
  selectedEvent: {
    id: 'evt1',
    summary: 'Team Meeting',
    start: { dateTime: '2026-04-02T10:00:00Z' },
    end: { dateTime: '2026-04-02T11:00:00Z' },
    location: 'Conference Room A',
    description: 'Weekly sync',
    attendees: null,
  },
  eventEditFields: {
    summary: 'Team Meeting',
    date: '2026-04-02',
    startTime: '10:00',
    endTime: '11:00',
    location: 'Conference Room A',
    description: 'Weekly sync',
  },
  setEventEditFields: jest.fn(),
  eventEditSaving: false,
  eventEditError: null,
  closeEventEdit: jest.fn(),
  saveEventEdit: jest.fn(),
};

const renderModal = (overrides = {}) =>
  render(<EventEditModal {...defaultProps} {...overrides} />);

describe('EventEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when eventEditOpen is false', () => {
    const { container } = renderModal({ eventEditOpen: false });
    expect(container.innerHTML).toBe('');
  });

  it('returns null when selectedEvent is null', () => {
    const { container } = renderModal({ selectedEvent: null });
    expect(container.innerHTML).toBe('');
  });

  it('renders when open with a selected event', () => {
    renderModal();
    expect(screen.getByText('Edit event')).toBeInTheDocument();
  });

  it('renders title field', () => {
    renderModal();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Event title')).toHaveValue('Team Meeting');
  });

  it('renders date field', () => {
    renderModal();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-02')).toBeInTheDocument();
  });

  it('renders time fields', () => {
    renderModal();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('11:00')).toBeInTheDocument();
  });

  it('renders location field', () => {
    renderModal();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Conference Room A')).toBeInTheDocument();
  });

  it('renders description field', () => {
    renderModal();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Weekly sync')).toBeInTheDocument();
  });

  it('shows Save button', () => {
    renderModal();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('shows Saving... when eventEditSaving is true', () => {
    renderModal({ eventEditSaving: true });
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('calls saveEventEdit when Save is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Save'));
    expect(defaultProps.saveEventEdit).toHaveBeenCalled();
  });

  it('calls closeEventEdit when Cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.closeEventEdit).toHaveBeenCalled();
  });

  it('shows attendees when present', () => {
    renderModal({
      selectedEvent: {
        ...defaultProps.selectedEvent,
        attendees: [
          { email: 'alice@example.com', name: 'Alice', status: 'accepted' },
          { email: 'bob@example.com', name: 'Bob', status: 'declined' },
          { email: 'carol@example.com', name: null, status: 'tentative' },
          { email: 'dave@example.com', name: 'Dave', status: 'needsAction' },
        ],
      },
    });
    expect(screen.getByText('Attendees')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.getByText('Maybe')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('does not show attendees section when no attendees', () => {
    renderModal();
    expect(screen.queryByText('Attendees')).not.toBeInTheDocument();
  });

  it('shows error message when eventEditError is set', () => {
    renderModal({ eventEditError: 'Failed to save event' });
    expect(screen.getByText('Failed to save event')).toBeInTheDocument();
  });

  it('calls setEventEditFields when title is changed', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Event title'), { target: { value: 'New Title' } });
    expect(defaultProps.setEventEditFields).toHaveBeenCalled();
  });
});
