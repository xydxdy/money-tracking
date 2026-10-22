// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/app/login/actions', () => ({ loginFormAction: vi.fn() }));
import { LoginForm } from '@/app/login/login-form';

afterEach(cleanup);

describe('LoginForm password visibility', () => {
  it('toggles the password between hidden and shown', () => {
    render(<LoginForm />);
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
