"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fill: "rgb(128 135 146)", fontFamily: "var(--font-inter)" };
const TOOLTIP = { contentStyle: { fontSize: 12, borderRadius: 4, border: "1px solid rgb(227 225 220)", boxShadow: "0 8px 24px rgb(16 24 40 / 0.08)" } };

export function TrendChart({ data, xKey, yKey, label }: { data: Record<string, string | number>[]; xKey: string; yKey: string; label: string }) {
  return (
    <figure>
      <div className="h-56" role="img" aria-label={`${label}: ${data.map((d) => `${d[xKey]} ${d[yKey]}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgb(227 225 220)" vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "rgb(205 202 196)" }} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} />
            <Line type="monotone" dataKey={yKey} name={label} stroke="rgb(22 38 68)" strokeWidth={2} dot={{ r: 2.5, fill: "rgb(22 38 68)" }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ColumnChart({ data, xKey, yKey, label, color = "rgb(35 56 94)" }: { data: Record<string, string | number>[]; xKey: string; yKey: string; label: string; color?: string }) {
  return (
    <div className="h-56" role="img" aria-label={`${label}: ${data.map((d) => `${d[xKey]} ${d[yKey]}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="rgb(227 225 220)" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "rgb(205 202 196)" }} interval={0} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP} cursor={{ fill: "rgb(236 240 247)" }} />
          <Bar dataKey={yKey} name={label} fill={color} radius={[2, 2, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
