import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Toast from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders error toast with message', () => {
    render(<Toast message="Something failed" type="error" onDismiss={jest.fn()} />);
    expect(screen.getByText('Something failed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('toast toast--error');
  });

  it('renders success toast with message', () => {
    render(<Toast message="Action succeeded" type="success" onDismiss={jest.fn()} />);
    expect(screen.getByText('Action succeeded')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('toast toast--success');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Test" type="error" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTitle('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after 5 seconds for success type', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Done" type="success" onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after 5 seconds for info type', () => {
    const onDismiss = jest.fn();
    render(<Toast message="FYI" type="info" onDismiss={onDismiss} />);

    act(() => { jest.advanceTimersByTime(5000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-dismiss for error type', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Error" type="error" onDismiss={onDismiss} />);

    act(() => { jest.advanceTimersByTime(10000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('returns null when message is empty', () => {
    const { container } = render(<Toast message="" type="error" onDismiss={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when message is undefined', () => {
    const { container } = render(<Toast onDismiss={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
