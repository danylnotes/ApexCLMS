"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fill: "rgb(140 145 154)", fontFamily: "var(--font-jakarta)" };
const TOOLTIP = { contentStyle: { fontSize: 12, borderRadius: 12, border: "1px solid rgb(235 235 229)", boxShadow: "0 8px 24px rgb(16 24 40 / 0.08)" } };

export function TrendChart({ data, xKey, yKey, label }: { data: Record<string, string | number>[]; xKey: string; yKey: string; label: string }) {
  return (
    <figure>
      <div className="h-56" role="img" aria-label={`${label}: ${data.map((d) => `${d[xKey]} ${d[yKey]}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgb(235 235 229)" vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "rgb(216 216 207)" }} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} />
            <Line type="monotone" dataKey={yKey} name={label} stroke="rgb(24 26 31)" strokeWidth={2} dot={{ r: 2.5, fill: "rgb(24 26 31)" }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ColumnChart({ data, xKey, yKey, label, color = "rgb(24 26 31)" }: { data: Record<string, string | number>[]; xKey: string; yKey: string; label: string; color?: string }) {
  return (
    <div className="h-56" role="img" aria-label={`${label}: ${data.map((d) => `${d[xKey]} ${d[yKey]}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="rgb(235 235 229)" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "rgb(216 216 207)" }} interval={0} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP} cursor={{ fill: "rgb(243 249 218)" }} />
          <Bar dataKey={yKey} name={label} fill={color} radius={[10, 10, 10, 10]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
