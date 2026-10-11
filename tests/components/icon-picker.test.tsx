// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { IconPicker } from '@/components/icon-picker';

afterEach(cleanup);

function submittedIcon(container: HTMLElement) {
  return (container.querySelector('input[name="icon"]') as HTMLInputElement).value;
}

describe('IconPicker', () => {
  it('submits the given icon and has no free-text box', () => {
    const { container } = render(<form><IconPicker name="icon" defaultValue="🍔" /></form>);
    expect(submittedIcon(container)).toBe('🍔');
    expect((container.querySelector('input[name="icon"]') as HTMLInputElement).type).toBe('hidden');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('sets the icon chosen from the dropdown grid', async () => {
    const { container } = render(<form><IconPicker name="icon" defaultValue="🍔" /></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Choose icon' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use ✈️' }));
    expect(submittedIcon(container)).toBe('✈️');
  });

  it('shuffles to a different random icon', () => {
    const { container } = render(<form><IconPicker name="icon" defaultValue="🍔" /></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Random icon' }));
    expect(submittedIcon(container)).not.toBe('🍔');
    expect(submittedIcon(container)).not.toBe('');
  });
});
