# Open Screens MCP

Read-only, local [Model Context Protocol](https://modelcontextprotocol.io/) server. Uses the [official TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/) and a public, versioned JSON catalogue published by GitHub Pages. No accounts or hosted MCP server are required.

```bash
cd mcp
npm install
npm start
```

Configure a compatible MCP client to run `node /ABSOLUTE/PATH/TO/YOUR/FORK/mcp/server.mjs` with an optional environment variable:

```json
{
  "mcpServers": {
    "open-screens": {
      "command": "node",
      "args": ["/absolute/path/to/screenshots-design-inspiration/mcp/server.mjs"],
      "env": {
        "CATALOG_URL": "https://mcmanussliam.github.io/screenshots-design-inspiration/catalog.json"
      }
    }
  }
}
```

Available tools: `search_products`, `get_product`, `search_screenshots`, `list_tags`. All tools are read-only and use capped pagination or output sizes. The catalogue is cached for 10 minutes, loaded through HTTPS, with a 15-second fetch timeout. Images are linked by URL; the MCP server never distributes binaries.

Pages cannot run a process or an MCP server itself. Install this Node package locally in the AI client.
