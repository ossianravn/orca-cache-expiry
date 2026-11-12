// The few Node APIs the worker and its test use, so `tsc` needs no @types/node install.
declare module 'node:fs/promises' {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>
  export function mkdtemp(prefix: string): Promise<string>
  export function readdir(path: string): Promise<string[]>
  export function readFile(path: string, encoding: 'utf8'): Promise<string>
  export function writeFile(path: string, data: string): Promise<void>
  export function stat(path: string): Promise<{ mtimeMs: number }>
  export function unlink(path: string): Promise<void>
}

declare module 'node:os' {
  export function homedir(): string
  export function tmpdir(): string
}

declare module 'node:path' {
  export function join(...parts: string[]): string
}

declare const process: { env: Record<string, string | undefined> }
declare function setInterval(handler: () => void, ms: number): unknown
declare function clearInterval(timer: unknown): void
