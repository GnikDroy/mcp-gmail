import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { tools } from "./tools/index.js";
import { log } from "./utils.js";

async function main() {
  log(`[${new Date().toISOString()}] server started\n`);

  const server = new Server({
    name: "gmail",
    version: "1.0.0",
    capabilities: {
      tools: {},
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    log(`[${new Date().toISOString()}] Request: ${JSON.stringify(request)}\n`);
    try {
      const tool = tools.find((t) => t.name === request.params.name);
      if (!tool) {
        throw new Error("Tool not found");
      }
      return await tool.handler(request.params.arguments);
    } catch (error: any) {
      log(`[${new Date().toISOString()}] Error: ${error.message}\n`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
