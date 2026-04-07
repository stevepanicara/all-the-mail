import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-quill before importing the component
jest.mock('react-quill', () => {
  const React = require('react');
  const MockQuill = React.forwardRef((props, ref) =>
    React.createElement('textarea', {
      'data-testid': 'mock-quill',
      value: props.value || '',
      onChange: (e) => props.onChange && props.onChange(e.target.value),
      placeholder: props.placeholder,
      ref,
    })
  );
  MockQuill.displayName = 'MockQuill';
  return MockQuill;
});

// Mock the CSS import
jest.mock('react-quill/dist/quill.snow.css', () => {});

import ComposeModal from './ComposeModal';

const defaultProps = {
  composeOpen: true,
  composeMode: 'compose',
  composeSending: false,
  composeError: null,
  composeFromAccountId: '1',
  setComposeFromAccountId: jest.fn(),
  composeTo: '',
  setComposeTo: jest.fn(),
  composeCc: '',
  setComposeCc: jest.fn(),
  composeBcc: '',
  setComposeBcc: jest.fn(),
  composeSubject: '',
  setComposeSubject: jest.fn(),
  composeBody: '',
  setComposeBody: jest.fn(),
  composeShowCcBcc: false,
  setComposeShowCcBcc: jest.fn(),
  composeAttachments: [],
  handleFileSelect: jest.fn(),
  removeAttachment: jest.fn(),
  connectedAccounts: [
    { id: '1', account_name: 'Work', gmail_email: 'work@gmail.com' },
    { id: '2', account_name: 'Personal', gmail_email: 'personal@gmail.com' },
  ],
  closeCompose: jest.fn(),
  sendCompose: jest.fn(),
};

const renderModal = (overrides = {}) =>
  render(<ComposeModal {...defaultProps} {...overrides} />);

describe('ComposeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when composeOpen is false', () => {
    const { container } = renderModal({ composeOpen: false });
    expect(container.innerHTML).toBe('');
  });

  it('renders when composeOpen is true', () => {
    renderModal();
    expect(screen.getByText('New message')).toBeInTheDocument();
  });

  it('renders form fields: To, Subject, From select', () => {
    renderModal();
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('recipient@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Subject')).toBeInTheDocument();
  });

  it('renders From select with connected accounts', () => {
    renderModal();
    expect(screen.getByText('Work — work@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Personal — personal@gmail.com')).toBeInTheDocument();
  });

  it('shows Send button', () => {
    renderModal();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('shows Sending... when composeSending is true', () => {
    renderModal({ composeSending: true });
    expect(screen.getByText('Sending...')).toBeInTheDocument();
  });

  it('shows "Show Cc/Bcc" toggle button', () => {
    renderModal();
    expect(screen.getByText('Show Cc/Bcc')).toBeInTheDocument();
  });

  it('shows Cc/Bcc fields when toggled', () => {
    renderModal({ composeShowCcBcc: true });
    expect(screen.getByText('Cc')).toBeInTheDocument();
    expect(screen.getByText('Bcc')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('cc@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('bcc@example.com')).toBeInTheDocument();
  });

  it('does not show Cc/Bcc fields when not toggled', () => {
    renderModal({ composeShowCcBcc: false });
    expect(screen.queryByPlaceholderText('cc@example.com')).not.toBeInTheDocument();
  });

  it('calls sendCompose when Send button is clicked', () => {
    renderModal({ composeSubject: 'Test subject' });
    fireEvent.click(screen.getByText('Send'));
    expect(defaultProps.sendCompose).toHaveBeenCalled();
  });

  it('calls closeCompose when Cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.closeCompose).toHaveBeenCalled();
  });

  it('displays correct mode title for reply', () => {
    renderModal({ composeMode: 'reply' });
    expect(screen.getByText('Reply')).toBeInTheDocument();
  });

  it('displays correct mode title for forward', () => {
    renderModal({ composeMode: 'forward' });
    expect(screen.getByText('Forward')).toBeInTheDocument();
  });

  it('shows error message when composeError is set', () => {
    renderModal({ composeError: 'Failed to send email' });
    expect(screen.getByText('Failed to send email')).toBeInTheDocument();
  });
});
