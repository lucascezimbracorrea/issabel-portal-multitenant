import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export function HourlyCallsChart({ hourly }: { hourly: number[] }) {
  const data = hourly.map((v, i) => ({ h: `${i}h`, calls: v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="h" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={3} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
          }}
          formatter={(v: number) => [v, 'Calls']}
        />
        <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
