import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from './ErrorBoundary';

// Suppress console.error for expected errors in tests
const originalConsoleError = console.error;
beforeAll(() => { console.error = jest.fn(); });
afterAll(() => { console.error = originalConsoleError; });

const ThrowingChild = ({ shouldThrow = true }) => {
  if (shouldThrow) throw new Error('Test error');
  return <div>Child content</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello world</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('resets error state when "Try again" is clicked', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <ErrorBoundary onReset={() => setShouldThrow(false)}>
          <ThrowingChild shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    };

    render(<TestComponent />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try again'));
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = ({ error, reset }) => (
      <div>
        <span>Custom: {error.message}</span>
        <button onClick={reset}>Custom reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom: Test error')).toBeInTheDocument();
    expect(screen.getByText('Custom reset')).toBeInTheDocument();
  });

  it('calls onReset callback when resetting', () => {
    const onReset = jest.fn();
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <ErrorBoundary onReset={() => { onReset(); setShouldThrow(false); }}>
          <ThrowingChild shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Try again'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('shows default message when error has no message', () => {
    const ThrowNull = () => { throw new Error(); };
    render(
      <ErrorBoundary>
        <ThrowNull />
      </ErrorBoundary>
    );
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
  });
});
