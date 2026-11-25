/**
 * Baris hasil query node:sqlite untuk SELECT dinamis (kolom ditentukan SQL,
 * bukan oleh TypeScript). Satu-satunya titik `any` di API layer; semua route
 * memakai tipe ini alih-alih `any` tersebar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
