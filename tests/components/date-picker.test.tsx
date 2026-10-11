// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DatePicker } from '@/components/date-picker';

afterEach(cleanup);

describe('DatePicker (compact filter style)', () => {
  it('shows its label and the date as DD/MM/YYYY', () => {
    render(<DatePicker compact label="From" name="from" defaultValue="2026-10-05" />);
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toHaveValue('05/10/2026');
  });

  it('reports a typed date as ISO only once it is complete and valid', () => {
    const onChange = vi.fn();
    render(<DatePicker compact label="To" name="to" onChange={onChange} />);
    const input = screen.getByLabelText('To date');
    fireEvent.change(input, { target: { value: '5/10/20' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '05/10/2026' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-10-05');
  });

  it('clears the date with the × button', () => {
    const onChange = vi.fn();
    render(<DatePicker compact label="From" name="from" defaultValue="2026-10-05" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear From' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByLabelText('From date')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear From' })).toBeNull();
  });
});
