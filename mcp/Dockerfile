# SwiftSign MCP server — stdio transport, for Glama and other container runtimes.
#
# The server speaks MCP over stdio and responds to `initialize` + `tools/list`
# with NO API key (this is what Glama's introspection check needs). Calling the
# tools requires a Bearer key set as the SWIFTSIGN_API_KEY environment variable;
# get one instantly from POST https://swiftsign.ca/api/v1/signup.
#
# Installs the published package so the build can't fail on a source compile.
FROM node:22-alpine
RUN npm install -g swiftsign-mcp@latest
ENTRYPOINT ["swiftsign-mcp"]
