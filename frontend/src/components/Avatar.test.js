import React from 'react';
import { render, screen } from '@testing-library/react';
import Avatar, { getAvatarColor } from './Avatar';

describe('Avatar', () => {
  it('renders initials from name', () => {
    const { container } = render(<Avatar name="John Doe" email="john@example.com" />);
    expect(container.textContent).toBe('J');
  });

  it('renders initials from email when name is absent', () => {
    const { container } = render(<Avatar email="alice@example.com" />);
    expect(container.textContent).toBe('A');
  });

  it('falls back to ? when no name or email', () => {
    const { container } = render(<Avatar />);
    expect(container.textContent).toBe('?');
  });

  it('renders an img element when src is provided', () => {
    render(<Avatar src="https://example.com/pic.jpg" email="a@b.com" name="A" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/pic.jpg');
  });

  it('applies correct size', () => {
    const { container } = render(<Avatar email="a@b.com" size={56} />);
    const div = container.firstChild;
    expect(div.style.width).toBe('56px');
    expect(div.style.height).toBe('56px');
  });

  it('applies ring box-shadow when ring prop is provided', () => {
    const { container } = render(<Avatar email="a@b.com" ring="#ff0000" />);
    expect(container.firstChild.style.boxShadow).toBe('0 0 0 2px #ff0000');
  });
});

describe('getAvatarColor', () => {
  it('returns a string color', () => {
    const color = getAvatarColor('test@example.com');
    expect(typeof color).toBe('string');
    expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('returns the same color for the same email', () => {
    expect(getAvatarColor('same@email.com')).toBe(getAvatarColor('same@email.com'));
  });

  it('handles empty string without throwing', () => {
    expect(() => getAvatarColor('')).not.toThrow();
  });

  it('handles null/undefined without throwing', () => {
    expect(() => getAvatarColor(null)).not.toThrow();
    expect(() => getAvatarColor(undefined)).not.toThrow();
  });
});
