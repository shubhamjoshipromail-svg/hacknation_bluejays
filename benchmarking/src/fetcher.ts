export interface FetchOptions { timeoutMs?: number; userAgent?: string }

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    headers: { "user-agent": options.userAgent ?? "HacknationBenchmarking/1.0 (research prototype)" }
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}
