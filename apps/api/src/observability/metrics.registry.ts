interface Sample {
  labels: Record<string, string>;
  value: number;
}

interface Metric {
  help: string;
  type: 'counter' | 'gauge';
  samples: Map<string, Sample>;
}

function labelsKey(labels: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))),
  );
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

export class MetricsRegistry {
  private readonly metrics = new Map<string, Metric>();

  increment(name: string, help: string, labels: Record<string, string> = {}, amount = 1): void {
    if (!Number.isFinite(amount) || amount < 0)
      throw new Error('Metric increment must be non-negative');
    const metric = this.get(name, help, 'counter');
    const key = labelsKey(labels);
    const current = metric.samples.get(key);
    metric.samples.set(key, { labels: { ...labels }, value: (current?.value ?? 0) + amount });
  }

  set(name: string, help: string, value: number, labels: Record<string, string> = {}): void {
    if (!Number.isFinite(value)) throw new Error('Metric value must be finite');
    const metric = this.get(name, help, 'gauge');
    metric.samples.set(labelsKey(labels), { labels: { ...labels }, value });
  }

  render(): string {
    const lines: string[] = [];
    for (const [name, metric] of [...this.metrics.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`# HELP ${name} ${metric.help.replace(/[\r\n]+/gu, ' ')}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      for (const sample of metric.samples.values()) {
        const labels = Object.entries(sample.labels)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
          .join(',');
        lines.push(`${name}${labels ? `{${labels}}` : ''} ${sample.value}`);
      }
    }
    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
  }

  private get(name: string, help: string, type: Metric['type']): Metric {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/u.test(name)) throw new Error('Invalid metric name');
    const existing = this.metrics.get(name);
    if (existing) {
      if (existing.help !== help || existing.type !== type)
        throw new Error('Metric definition changed');
      return existing;
    }
    const metric = { help, type, samples: new Map<string, Sample>() };
    this.metrics.set(name, metric);
    return metric;
  }
}

export const observabilityMetrics = new MetricsRegistry();
