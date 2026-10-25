import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const AXIS = { fontSize: 11, fill: "hsl(215 12% 40%)" };

export default function TrendChart({ data, dataKey, label, unit }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-md bg-muted text-sm text-[hsl(36_30%_74%)]">
        No results yet
      </div>
    );
  }
  return (
    <div role="img" aria-label={`${label} trend chart`}>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="hsl(214 16% 90%)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={AXIS} domain={["auto", "auto"]} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [`${v}${unit ? ` ${unit}` : ""}`, label]}
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 16% 90%)", fontSize: 12, boxShadow: "none" }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="hsl(189 80% 22%)"
            strokeWidth={2}
            dot={{ r: 3.5, strokeWidth: 0, fill: "hsl(189 80% 22%)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}