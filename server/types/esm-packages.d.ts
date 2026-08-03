// Ambient declarations for ESM-only packages.
//
// got, chalk and file-type dropped CommonJS in recent majors (got v13+,
// chalk v5+, file-type v17+). The server still compiles to CommonJS with
// moduleResolution "node", which cannot resolve their "exports" maps.
// Runtime is fine: Node >=22.12 can require() ESM modules. These shims
// restore type-checking with the minimal API surface actually used.

declare module "got" {
	export interface Response<T = string> {
		body: T;
		statusCode: number;
	}
	export interface Options {
		headers?: Record<string, string>;
		timeout?: number | {request?: number};
		[key: string]: unknown;
	}
	export function stream(url: string, options?: Options): import("stream").Readable;
	interface Got {
		<T = string>(url: string, options?: Options): Promise<Response<T>>;
		stream: typeof stream;
	}
	const got: Got;
	export default got;
}

declare module "chalk" {
	interface Chalk {
		(text: string): string;
		blue: Chalk;
		bold: Chalk;
		cyan: Chalk;
		dim: Chalk;
		green: Chalk;
		red: Chalk;
		yellow: Chalk;
	}
	const chalk: Chalk;
	export default chalk;
}

declare module "file-type" {
	export interface FileTypeResult {
		ext: string;
		mime: string;
	}
	export function fileTypeFromBuffer(
		buffer: ArrayBuffer | Uint8Array
	): Promise<FileTypeResult | undefined>;
}
