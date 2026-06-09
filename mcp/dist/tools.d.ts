import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface ToolContext {
    apiUrl: string;
    resolveKey: (extra?: {
        authInfo?: {
            token?: string;
        };
    }) => string | undefined;
    allowFileWrites: boolean;
    allowSignup: boolean;
    defaultSource?: string;
}
export declare function formatApiError(status: number, text: string): string;
export declare function registerSwiftSignTools(server: McpServer, ctx: ToolContext): void;
