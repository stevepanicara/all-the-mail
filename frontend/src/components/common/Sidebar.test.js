import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';

const defaultProps = {
  sidebarCollapsed: false,
  setSidebarCollapsed: jest.fn(),
  activeCategory: 'primary',
  setActiveCategory: jest.fn(),
  categoryCounts: { primary: 12, social: 3, promotions: 5 },
  openCompose: jest.fn(),
  clearSelection: jest.fn(),
  setSelectedEmail: jest.fn(),
  setSelectedThread: jest.fn(),
  setSelectedThreadActiveMessageId: jest.fn(),
  setEditMode: jest.fn(),
  setFullPageReaderOpen: jest.fn(),
};

const renderSidebar = (overrides = {}) =>
  render(<Sidebar {...defaultProps} {...overrides} />);

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all category buttons', () => {
    renderSidebar();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Promotions')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();
  });

  it('shows "New message" button', () => {
    renderSidebar();
    expect(screen.getByText('New message')).toBeInTheDocument();
  });

  it('calls openCompose when "New message" is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('New message'));
    expect(defaultProps.openCompose).toHaveBeenCalledWith('compose');
  });

  it('clicking a category calls setActiveCategory', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Social'));
    expect(defaultProps.setActiveCategory).toHaveBeenCalledWith('social');
  });

  it('clicking a category clears selection state', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Trash'));
    expect(defaultProps.setSelectedEmail).toHaveBeenCalledWith(null);
    expect(defaultProps.setSelectedThread).toHaveBeenCalledWith(null);
    expect(defaultProps.setSelectedThreadActiveMessageId).toHaveBeenCalledWith(null);
    expect(defaultProps.setEditMode).toHaveBeenCalledWith(false);
    expect(defaultProps.clearSelection).toHaveBeenCalled();
    expect(defaultProps.setFullPageReaderOpen).toHaveBeenCalledWith(false);
  });

  it('displays category counts', () => {
    renderSidebar();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('collapsed state shows single chars with title attributes', () => {
    renderSidebar({ sidebarCollapsed: true });
    // In collapsed mode, categories show first char and have title for tooltip
    expect(screen.getByTitle('Primary')).toBeInTheDocument();
    expect(screen.getByTitle('Social')).toBeInTheDocument();
    expect(screen.getByTitle('Promotions')).toBeInTheDocument();
    expect(screen.getByTitle('Sent')).toBeInTheDocument();
    expect(screen.getByTitle('Drafts')).toBeInTheDocument();
    expect(screen.getByTitle('Trash')).toBeInTheDocument();
    // Verify single chars are rendered (P appears twice: Primary, Promotions; S twice: Social, Sent)
    expect(screen.getAllByText('P')).toHaveLength(2);
    expect(screen.getAllByText('S')).toHaveLength(2);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('collapse button toggles sidebar', () => {
    renderSidebar();
    const collapseBtn = screen.getByTitle('Collapse sidebar');
    fireEvent.click(collapseBtn);
    expect(defaultProps.setSidebarCollapsed).toHaveBeenCalledWith(true);
  });

  it('expand button shown when collapsed', () => {
    renderSidebar({ sidebarCollapsed: true });
    expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument();
  });
});
