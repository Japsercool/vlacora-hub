import http from "node:http";
import https from "node:https";

export type NativeHttpResult = {
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  text: string;
  durationMs: number;
  transport: "node:http" | "node:https";
};

export type NativeHttpError = Error & {
  code?: string | number;
  errno?: string | number;
  syscall?: string;
  address?: string;
  port?: number;
};

export function nativeHttpGet(
  target: string,
  headers: Record<string, string>,
  timeoutMs = 20000,
  maxBytes = 4 * 1024 * 1024
): Promise<NativeHttpResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const url = new URL(target);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;

    const requestHeaders: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "VLACORA-Hub/0.9.1",
      Connection: "close",
      ...headers,
    };

    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : isHttps ? 443 : 80,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        headers: requestHeaders,
        agent: false,
        ...(isHttps ? { rejectUnauthorized: true } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        let completed = false;

        const finishError = (error: NativeHttpError) => {
          if (completed) return;
          completed = true;
          res.destroy();
          reject(error);
        };

        res.on("data", (chunk: Buffer | string) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buf.length;
          if (bytes > maxBytes) {
            const error = new Error(`Radio API response is groter dan ${Math.round(maxBytes / 1024 / 1024)} MB.`) as NativeHttpError;
            error.code = "ERESPONSETOOLARGE";
            finishError(error);
            return;
          }
          chunks.push(buf);
        });

        res.on("end", () => {
          if (completed) return;
          completed = true;
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || "",
            headers: res.headers,
            text: Buffer.concat(chunks).toString("utf8"),
            durationMs: Date.now() - started,
            transport: isHttps ? "node:https" : "node:http",
          });
        });

        res.on("aborted", () => {
          const error = new Error("Radio API heeft de HTTP-response voortijdig afgebroken.") as NativeHttpError;
          error.code = "ERESPONSEABORTED";
          finishError(error);
        });

        res.on("error", (error) => finishError(error as NativeHttpError));
      }
    );

    req.setTimeout(timeoutMs, () => {
      const error = new Error(`HTTP response timeout na ${timeoutMs} ms.`) as NativeHttpError;
      error.code = "ETIMEDOUT";
      req.destroy(error);
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

export function nativeError(error: unknown) {
  const e = error as NativeHttpError;
  return {
    name: e?.name,
    message: String(e?.message || error || "Unknown error"),
    code: e?.code,
    errno: e?.errno,
    syscall: e?.syscall,
    address: e?.address,
    port: e?.port,
  };
}


export function nativeHttpJson(
  method:"POST"|"PUT"|"PATCH",
  target:string,
  headers:Record<string,string>,
  payload:unknown,
  timeoutMs=25000,
  maxBytes=4*1024*1024
):Promise<NativeHttpResult>{
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const url=new URL(target);
    const isHttps=url.protocol==="https:";
    const client=isHttps?https:http;
    const body=Buffer.from(JSON.stringify(payload??{}),"utf8");
    const requestHeaders:Record<string,string>={
      Accept:"application/json",
      "Content-Type":"application/json; charset=utf-8",
      "Content-Length":String(body.length),
      "User-Agent":"VLACORA-Hub/0.12.0",
      Connection:"close",
      ...headers
    };
    const req=client.request({
      protocol:url.protocol,hostname:url.hostname,port:url.port?Number(url.port):isHttps?443:80,
      method,path:`${url.pathname}${url.search}`,headers:requestHeaders,agent:false,
      ...(isHttps?{rejectUnauthorized:true}:{})
    },res=>{
      const chunks:Buffer[]=[];let bytes=0;let completed=false;
      const fail=(error:NativeHttpError)=>{if(completed)return;completed=true;res.destroy();reject(error)};
      res.on("data",(chunk:Buffer|string)=>{const buf=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=buf.length;if(bytes>maxBytes){const e=new Error("Radio API response is te groot.") as NativeHttpError;e.code="ERESPONSETOOLARGE";return fail(e)}chunks.push(buf)});
      res.on("end",()=>{if(completed)return;completed=true;resolve({status:res.statusCode||0,statusText:res.statusMessage||"",headers:res.headers,text:Buffer.concat(chunks).toString("utf8"),durationMs:Date.now()-started,transport:isHttps?"node:https":"node:http"})});
      res.on("aborted",()=>{const e=new Error("Radio API heeft de response afgebroken.") as NativeHttpError;e.code="ERESPONSEABORTED";fail(e)});
      res.on("error",e=>fail(e as NativeHttpError));
    });
    req.setTimeout(timeoutMs,()=>{const e=new Error(`HTTP response timeout na ${timeoutMs} ms.`) as NativeHttpError;e.code="ETIMEDOUT";req.destroy(e)});
    req.on("error",reject);req.write(body);req.end();
  });
}
