import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SourceChip from './SourceChip';

describe('SourceChip', () => {
  it('renders with account name as short label', () => {
    render(<SourceChip accountName="Acme Design Studio" accountId="1" />);
    expect(screen.getByText('ADS')).toBeInTheDocument();
  });

  it('shows short label from getAccountShortLabel', () => {
    render(<SourceChip accountName="Notion" accountId="2" />);
    expect(screen.getByText('NOTI')).toBeInTheDocument();
  });

  it('has the full account name as a title attribute', () => {
    render(<SourceChip accountName="Ranger & Fox" accountId="3" />);
    expect(screen.getByTitle('Ranger & Fox')).toBeInTheDocument();
  });

  it('has the correct aria-label', () => {
    render(<SourceChip accountName="Work" accountId="4" />);
    expect(screen.getByLabelText('From Work')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onClick = jest.fn();
    render(<SourceChip accountName="Personal" accountId="5" onClick={onClick} />);
    fireEvent.click(screen.getByText('PERS'));
    expect(onClick).toHaveBeenCalledWith('5');
  });

  it('click does not propagate when onClick is provided', () => {
    const onClick = jest.fn();
    const parentClick = jest.fn();
    const { container } = render(
      <div onClick={parentClick}>
        <SourceChip accountName="Test Account" accountId="6" onClick={onClick} />
      </div>
    );
    fireEvent.click(screen.getByText('TA'));
    expect(onClick).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('returns null when no label (empty accountName)', () => {
    const { container } = render(<SourceChip accountName="" accountId="7" />);
    expect(container.innerHTML).toBe('');
  });

  it('adds clickable class when onClick is provided', () => {
    const onClick = jest.fn();
    render(<SourceChip accountName="Work" accountId="8" onClick={onClick} />);
    const chip = screen.getByText('WORK');
    expect(chip.className).toContain('source-chip--clickable');
  });

  it('does not add clickable class when onClick is not provided', () => {
    render(<SourceChip accountName="Work" accountId="9" />);
    const chip = screen.getByText('WORK');
    expect(chip.className).not.toContain('source-chip--clickable');
  });

  it('uses pill variant by default', () => {
    render(<SourceChip accountName="Work" accountId="10" />);
    const chip = screen.getByText('WORK');
    expect(chip.className).toContain('source-chip--pill');
  });

  it('supports dot variant', () => {
    render(<SourceChip accountName="Work" accountId="11" variant="dot" />);
    const chip = screen.getByText('WORK');
    expect(chip.className).toContain('source-chip--dot');
  });
});
