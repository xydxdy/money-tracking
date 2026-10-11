// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { ConfirmButton } from '@/components/confirm-button';

afterEach(cleanup);

describe('ConfirmButton with confirmText', () => {
  it('only enables Confirm once the exact name is typed', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmButton label="Delete" description="Delete Groceries?" confirmText="Groceries" onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm' });
    const input = screen.getByLabelText(/type .*Groceries.* to confirm/i);

    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: 'groceries' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Groceries' } });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('does not require typing when confirmText is not set', async () => {
    render(<ConfirmButton label="Archive" description="Archive?" variant="outline" onConfirm={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByRole('button', { name: 'Confirm' })).toBeEnabled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
