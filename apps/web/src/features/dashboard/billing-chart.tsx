import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

export function BillingChart({ activeOrganizations: _activeOrganizations, mrrUsd }: { activeOrganizations: number; mrrUsd: number }) {
  const factors = [0.55, 0.62, 0.7, 0.78, 0.88, 1];
  const data = factors.map((f, i) => ({
    name: `T${i + 1}`,
    mrr: Math.max(0, Math.round(mrrUsd * f)),
    i,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
          }}
          formatter={(value: number) => [
            new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value),
            'MRR',
          ]}
        />
        <Bar dataKey="mrr" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={BAR_COLORS[entry.i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
