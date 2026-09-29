'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { fromCents } from '@/lib/money';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

// Each call renders a single currency's series — the page extracts one currency's numbers out of
// getDashboardData's per-currency Records before calling these, so no chart ever mixes amounts
// from two different currencies. `fromCents` (not raw `/100`) keeps the conversion consistent
// with the rest of the app's money handling.
export function TrendChart({ data }: { data: { month: string; incomeCents: number; expenseCents: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data.map((d) => ({ ...d, income: Number(fromCents(d.incomeCents)), expense: Number(fromCents(d.expenseCents)) }))}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="income" fill="#16a34a" />
        <Bar dataKey="expense" fill="#dc2626" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpendingPie({ data }: { data: { name: string; cents: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data.map((d) => ({ ...d, value: Number(fromCents(d.cents)) }))} dataKey="value" nameKey="name" outerRadius={90}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
