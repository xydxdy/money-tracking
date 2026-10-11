// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { ActionsMenu } from '@/components/actions-menu';

afterEach(cleanup);

function setup(onDelete = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ActionsMenu
      label="the Food category"
      editTitle="Edit Food"
      renderEdit={(close) => <button type="button" onClick={close}>Fake save</button>}
      deleteDescription="Delete Food?"
      confirmText="Food"
      onDelete={onDelete}
    />,
  );
  return onDelete;
}

describe('ActionsMenu', () => {
  it('opens the edit form from the menu and closes it when the form saves', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for the Food category' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(await screen.findByText('Edit Food')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fake save' }));
    await waitFor(() => expect(screen.queryByText('Edit Food')).toBeNull());
  });

  it('deletes only after the name is typed', async () => {
    const onDelete = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for the Food category' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }));
    const confirm = await screen.findByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type .*Food.* to confirm/i), { target: { value: 'Food' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });
});
