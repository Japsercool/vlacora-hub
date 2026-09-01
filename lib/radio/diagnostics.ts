import net from "node:net";

export function describeError(error: unknown) {
  const e = error as any;
  const cause = e?.cause as any;
  return {
    name: e?.name,
    message: String(e?.message || error || "Unknown error"),
    code: cause?.code || e?.code,
    errno: cause?.errno || e?.errno,
    syscall: cause?.syscall || e?.syscall,
    address: cause?.address || e?.address,
    port: cause?.port || e?.port,
    cause: cause ? {
      name: cause?.name,
      message: cause?.message,
      code: cause?.code,
      errno: cause?.errno,
      syscall: cause?.syscall,
      address: cause?.address,
      port: cause?.port
    } : undefined
  };
}

export function tcpProbe(host: string, port: number, timeoutMs = 7000) {
  return new Promise<any>((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host, port });
    let finished = false;

    const done = (payload: any) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({ ...payload, durationMs: Date.now() - started });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done({ ok: true }));
    socket.once("timeout", () => done({
      ok: false,
      error: { message: "TCP connection timed out", code: "ETIMEDOUT", address: host, port }
    }));
    socket.once("error", (error) => done({ ok: false, error: describeError(error) }));
  });
}

export function runtimeInfo() {
  return {
    node: process.version,
    vercelRegion:
      process.env.VERCEL_REGION ||
      process.env.VERCEL_REGION_ID ||
      process.env.AWS_REGION ||
      "unknown"
  };
}
