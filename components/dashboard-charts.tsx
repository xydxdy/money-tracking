'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function TrendChart({ data }: { data: { month: string; incomeCents: number; expenseCents: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data.map((d) => ({ ...d, income: d.incomeCents / 100, expense: d.expenseCents / 100 }))}>
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
        <Pie data={data.map((d) => ({ ...d, value: d.cents / 100 }))} dataKey="value" nameKey="name" outerRadius={90}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
