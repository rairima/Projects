# Projects

# Project-1: Projects\mcp-server-js-example:
It contains a minimal MCP (Model Context Protocol) server example implemented in Node.js. 
It is intended as a starting point for building a server that exposes a small set of safe, discoverable
tools to an AI client using the MCP protocol.

## Overview

Key behaviors implemented by the example server:

1. Configuration: loads secrets and options (GitHub token, workspace directory) from a `.env` file.
2. Validation: restricts repository names, branch names, and file paths to reduce risky operations.
3. MCP registration: each `registerTool()` call exposes a function the AI client can discover and invoke.
4. Octokit: performs authenticated GitHub API requests where needed.
5. simple-git: runs Git operations inside the configured workspace.
6. Standard I/O transport: communicates with the MCP client over stdin/stdout.

The server deliberately operates inside an explicit workspace directory and does not allow arbitrary shell execution or unrestricted filesystem access.

## Quick start

1. Install dependencies:

```bash
npm install
Create a .env file in the project root with the required variables. Example:
env
GITHUB_TOKEN=ghp_xxx                      # token used by Octokit (use least privilege)
WORKSPACE_DIR=/path/to/local/workspace     # local directory where repositories will be cloned
PORT=3000                                  # optional, if your server exposes an HTTP health endpoint
Never commit tokens to source control. For production, prefer a GitHub App with narrowly scoped permissions.

Configure Git authentication
This project uses Octokit for GitHub API requests. Git commands such as clone, pull, and push use your Git credential configuration.

For local development, you can authenticate with the GitHub CLI:

bash
# install: https://cli.github.com
gh auth login
gh auth setup-git
Verify authentication:

bash
gh auth status
git config --get credential.helper
The second command may return nothing if your Git installation uses another credential mechanism; that doesn't necessarily indicate a problem.

Important: never embed a personal access token directly in a repository URL or print it to logs.

Run the server
Start the server from the project directory:

bash
npm start
The process typically stays running without printing normal application logs — stdin/stdout are used for MCP communication.

Inspecting and testing tools
Open a second terminal to run the MCP Inspector so you can interactively discover tools and test them:

bash
npx -y @modelcontextprotocol/inspector node server.js
The Inspector connects to a local MCP server and lets you explore available tools and their input schemas. Follow the Inspector's displayed instructions if it differs by version.
```
Recommended test flow (try these in order):

Try these tools in order:

1. `list_repositories`
2. `create_repository`
3. `clone_repository`
4. `git_status`
5. `git_create_branch`
6. `git_commit`
7. `git_push`

# Image Referneces:

![alt text](image.png)
![alt text](image-1.png)