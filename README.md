# Projects

# Project-1: Projects\mcp-server-js-example:


### How the code works

1. Configuration: Loads the GitHub token and workspace directory from `.env`.
2. Validation: Restricts repository names, branch names, and file paths to reduce unsafe operations.
3. MCP registration: Each `registerTool()` call exposes a function that the AI client can discover and invoke.
4. Octokit: Executes authenticated GitHub API requests.
5. simple-git: Runs Git operations inside your local workspace.
6. Standard I/O transport: Communicates with the MCP client using the MCP protocol.

The server uses an explicit workspace instead of allowing the AI to run arbitrary shell commands or operate on arbitrary directories.

## 6. Configure Git authentication

The code above authenticates GitHub API requests using Octokit. Git commands such as `clone`, `pull`, and `push` use Git's own authentication configuration.

For a local development machine, you can use GitHub CLI:

Install it from [cli.github.com](<https://cli.github.com/?utm_source=chatgpt.com>), then run:

bash
```
gh auth login
gh auth setup-git
```

Follow the prompts to authenticate your GitHub account. This configures Git to use GitHub CLI credentials on supported setups.

Test authentication:

bash
```
gh auth status
git config --get credential.helper
```

The second command may return nothing if your Git installation uses a different credential mechanism; that alone doesn't mean authentication is broken.

Important: Never embed a personal access token directly in a repository URL or print it to logs. For an organization or production deployment, prefer a GitHub App with narrowly scoped permissions.

## 7. Start the server and verify it

From the project directory, run:

bash
```
npm start
```

The process should stay running without printing normal log messages. That is expected: standard input and output are being used for MCP communication.

To test the available tools interactively, open a second terminal and run:

bash
```
npx -y @modelcontextprotocol/inspector node server.js
```

The MCP Inspector lets you connect to a local server and inspect its tools and input schemas. If you use a different version of the Inspector, follow its displayed launch instructions.

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