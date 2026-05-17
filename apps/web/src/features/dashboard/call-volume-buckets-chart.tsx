import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Downsample bucket series for chart readability */
function downsample(buckets: number[], groupSize: number) {
  const out: { name: string; calls: number }[] = [];
  for (let i = 0; i < buckets.length; i += groupSize) {
    const slice = buckets.slice(i, i + groupSize);
    const calls = slice.reduce((a, n) => a + n, 0);
    out.push({ name: `${i}`, calls });
  }
  return out;
}

export function CallVolumeBucketsChart({
  buckets,
  bucketMinutes,
  title,
}: {
  buckets: number[];
  bucketMinutes: number;
  title: string;
}) {
  const data = useMemo(() => {
    const g = Math.max(1, Math.floor(buckets.length / 48));
    return downsample(buckets.length ? buckets : Array.from({ length: 48 }, () => 0), g).map((row, idx) => ({
      ...row,
      name: `${idx * g * bucketMinutes}m`,
    }));
  }, [buckets, bucketMinutes]);

  return (
    <div className="h-72 w-full">
      <p className="mb-2 text-xs text-muted-foreground">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={32} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
            }}
            formatter={(value: number) => [value, 'chamadas']}
          />
          <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="#6366f133" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
