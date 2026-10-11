// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CurrencySelect } from '@/components/currency-select';

afterEach(cleanup);

const submitted = (container: HTMLElement) => (container.querySelector('input[name="currency"]') as HTMLInputElement).value;

describe('CurrencySelect', () => {
  it('submits the default currency', () => {
    const { container } = render(<form><CurrencySelect name="currency" defaultValue="THB" /></form>);
    expect(submitted(container)).toBe('THB');
    expect(screen.queryByLabelText('Currency code')).toBeNull();
  });

  it('opens on "Other" for a currency outside the list and submits a typed code in upper case', () => {
    const { container } = render(<form><CurrencySelect name="currency" defaultValue="XAU" /></form>);
    const input = screen.getByLabelText('Currency code');
    expect(submitted(container)).toBe('XAU');
    fireEvent.change(input, { target: { value: 'ch-f9' } });
    expect(submitted(container)).toBe('CHF');
  });
});
