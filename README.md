# thinktank-mcp demo console

A static chat page for thinktank-mcp. It is three files: `index.html`, `console.css` and `console.js`.

The page holds no data and no token. Every question goes from your browser to an MCP server that you run yourself. You tell the page where that server is with the `?server=` query parameter.

## Use it

Open this address, with your own server in place of the example:

    https://lampagj.github.io/thinktank-mcp-console/?server=http://localhost:8787

The page remembers the server in that browser, so you only add `?server=` once.

## What your server must do

- It must answer cross-origin requests (CORS) for this page's origin, because the page is served from `lampagj.github.io` and your server is somewhere else.
- In Chromium, the browser asks for the Local Network Access permission the first time this page reaches a server on your own machine. Allow it. Safari blocks the request.

## What is in this repository

Only the static console files. They are copied unchanged from the thinktank-mcp project. The repository holds no configuration, no credentials and no organisation data.
