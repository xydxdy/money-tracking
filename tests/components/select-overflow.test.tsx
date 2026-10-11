// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

afterEach(cleanup);

// Layout can't be measured in jsdom, so this guards the classes that make long labels truncate
// with an ellipsis instead of spilling out of the dropdown.
describe('Select long-label handling', () => {
  it('lets the trigger shrink and truncates the selected label', () => {
    const long = '🏦 A very long account name that would not fit (THB)';
    const { container } = render(
      <Select value="a" items={{ a: long }}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="a">{long}</SelectItem></SelectContent>
      </Select>,
    );
    const trigger = container.querySelector('[data-slot="select-trigger"]')!;
    const value = container.querySelector('[data-slot="select-value"]')!;
    expect(trigger).toHaveClass('min-w-0', 'max-w-full', 'w-44');
    expect(value).toHaveClass('truncate', 'min-w-0', 'block');
    expect(value).toHaveTextContent(long);
  });
});
