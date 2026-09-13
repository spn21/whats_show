// Override Next.js types for compatibility with Next.js 15

declare module 'next' {
  export interface PageProps {
    params?: Record<string, string> | Promise<Record<string, string>>;
    searchParams?: Record<string, string | string[]>;
  }
}
