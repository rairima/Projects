
import "dotenv/config";

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Octokit } from "octokit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { simpleGit } from "simple-git";


/*
How the code works
Configuration: Loads the GitHub token and workspace directory from .env.

Validation: Restricts repository names, branch names, and file paths to reduce unsafe operations.

MCP registration: Each registerTool() call exposes a function that the AI client can discover and invoke.

Octokit: Executes authenticated GitHub API requests.

simple-git: Runs Git operations inside your local workspace.

Standard I/O transport: Communicates with the MCP client using the MCP protocol.

The server uses an explicit workspace instead of allowing the AI to run arbitrary shell commands or operate on arbitrary directories.

*/
// --------------------------------------------------
// 1. Configuration
// --------------------------------------------------

const token = process.env.GITHUB_TOKEN;
const configuredOwner = process.env.GITHUB_OWNER;

if (!token || !configuredOwner) {
  throw new Error(
    "Set GITHUB_TOKEN and GITHUB_OWNER in your .env file."
  );
}

const owner = configuredOwner;
const octokit = new Octokit({ auth: token });

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(
  here,
  process.env.WORKSPACE_DIR || "./workspace"
);

await fs.mkdir(workspace, { recursive: true });

// --------------------------------------------------
// 2. Validation and workspace protection
// --------------------------------------------------

function validateName(value, label = "name") {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_.-]+$/.test(value) ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
}

function getRepoPath(repo) {
  validateName(repo, "repository name");

  const resolved = path.resolve(workspace, repo);

  if (
    resolved === workspace ||
    !resolved.startsWith(workspace + path.sep)
  ) {
    throw new Error("Repository path is outside the workspace.");
  }

  return resolved;
}

function validateBranch(branch) {
  if (
    typeof branch !== "string" ||
    branch.length > 200 ||
    branch.startsWith("-") ||
    branch.startsWith("/") ||
    branch.endsWith("/") ||
    branch.includes("..") ||
    branch.endsWith(".") ||
    /[\s~^:?*[\]\\]/.test(branch) ||
    branch.includes("@{") ||
    branch.includes("//")
  ) {
    throw new Error("Invalid branch name.");
  }

  return branch;
}

function validateFilePath(file) {
  if (
    typeof file !== "string" ||
    !file ||
    path.isAbsolute(file) ||
    file.includes("\\") ||
    file.split("/").some(
      (part) => !part || part === "." || part === ".."
    )
  ) {
    throw new Error(`Invalid relative file path: ${file}`);
  }

  return file;
}

async function getGit(repo) {
  const dir = getRepoPath(repo);
  const git = simpleGit(dir);

  if (!(await git.checkIsRepo())) {
    throw new Error(
      `Repository '${repo}' is not cloned in the workspace.`
    );
  }

  return git;
}

function result(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

// --------------------------------------------------
// 3. Create MCP server
// --------------------------------------------------

const server = new McpServer({
  name: "github-productivity-server",
  version: "1.0.0"
});

// --------------------------------------------------
// 4. List GitHub repositories
// --------------------------------------------------

server.registerTool(
  "list_repositories",
  {
    description: "List repositories owned by the configured GitHub user.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(20)
    }
  },
  async ({ limit }) => {
    const response = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: limit,
      sort: "updated",
      direction: "desc"
    });

    return result(
      response.data.map((repo) => ({
        name: repo.name,
        private: repo.private,
        url: repo.html_url,
        default_branch: repo.default_branch
      }))
    );
  }
);

// --------------------------------------------------
// 5. Create a new GitHub repository
// --------------------------------------------------

server.registerTool(
  "create_repository",
  {
    description: "Create a GitHub repository for the configured user.",
    inputSchema: {
      name: z.string().min(1).max(100),
      description: z.string().max(350).default(""),
      private: z.boolean().default(true)
    }
  },
  async ({ name, description, private: isPrivate }) => {
    validateName(name, "repository name");

    const response =
      await octokit.rest.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true
      });

    return result({
      message: "Repository created.",
      name: response.data.name,
      url: response.data.html_url,
      clone_url: response.data.clone_url,
      default_branch: response.data.default_branch
    });
  }
);

// --------------------------------------------------
// 6. Create a remote GitHub branch
// --------------------------------------------------

server.registerTool(
  "create_branch",
  {
    description: "Create a branch on GitHub from an existing branch.",
    inputSchema: {
      repo: z.string(),
      branch: z.string(),
      base_branch: z.string().default("main")
    }
  },
  async ({ repo, branch, base_branch }) => {
    validateName(repo, "repository name");
    validateBranch(branch);
    validateBranch(base_branch);

    const base = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: base_branch
    });

    const response = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: base.data.commit.sha
    });

    return result({
      message: "Remote branch created.",
      branch,
      sha: response.data.object.sha
    });
  }
);

// --------------------------------------------------
// 7. Clone a repository to the workspace
// --------------------------------------------------

server.registerTool(
  "clone_repository",
  {
    description: "Clone an owned GitHub repository into the workspace.",
    inputSchema: {
      repo: z.string()
    }
  },
  async ({ repo }) => {
    validateName(repo, "repository name");

    const dir = getRepoPath(repo);

    try {
      await fs.access(dir);
      throw new Error(
        `Workspace path already exists: ${dir}.`
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    // Look up the repository instead of accepting an arbitrary URL.
    const remote = await octokit.rest.repos.get({
      owner,
      repo
    });

    // For private repositories, configure Git credentials separately.
    await simpleGit().clone(remote.data.clone_url, dir);

    return result({
      message: "Repository cloned.",
      repo,
      local_path: dir
    });
  }
);

// --------------------------------------------------
// 8. Inspect local Git status
// --------------------------------------------------

server.registerTool(
  "git_status",
  {
    description: "Show the current branch and working-tree changes.",
    inputSchema: {
      repo: z.string()
    }
  },
  async ({ repo }) => {
    const git = await getGit(repo);
    const status = await git.status();

    return result({
      branch: status.current,
      clean: status.isClean(),
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      not_added: status.not_added,
      conflicted: status.conflicted
    });
  }
);

// --------------------------------------------------
// 9. Create and switch to a local branch
// --------------------------------------------------

server.registerTool(
  "git_create_branch",
  {
    description: "Create a local branch and switch to it.",
    inputSchema: {
      repo: z.string(),
      branch: z.string()
    }
  },
  async ({ repo, branch }) => {
    validateBranch(branch);

    const git = await getGit(repo);
    await git.checkoutLocalBranch(branch);

    return result({
      message: "Switched to new local branch.",
      repo,
      branch
    });
  }
);

// --------------------------------------------------
// 10. Pull changes from GitHub
// --------------------------------------------------

server.registerTool(
  "git_pull",
  {
    description: "Pull changes from origin for a specified branch.",
    inputSchema: {
      repo: z.string(),
      branch: z.string()
    }
  },
  async ({ repo, branch }) => {
    validateBranch(branch);

    const git = await getGit(repo);
    const status = await git.status();

    if (!status.isClean()) {
      throw new Error(
        "Working tree is not clean. Commit or safely stash changes before pulling."
      );
    }

    await git.pull("origin", branch);

    return result({
      message: "Pull completed.",
      repo,
      branch
    });
  }
);

// --------------------------------------------------
// 11. Stage selected files and commit
// --------------------------------------------------

server.registerTool(
  "git_commit",
  {
    description: "Stage explicitly selected files and create a commit.",
    inputSchema: {
      repo: z.string(),
      files: z.array(z.string()).min(1).max(100),
      message: z.string().min(1).max(500)
    }
  },
  async ({ repo, files, message }) => {
    const git = await getGit(repo);
    const safeFiles = files.map(validateFilePath);

    // Reject symlinks in parent directories to prevent workspace escape.
    const root = getRepoPath(repo);

    for (const file of safeFiles) {
      const segments = file.split("/");
      let current = root;

      for (const segment of segments.slice(0, -1)) {
        current = path.join(current, segment);

        try {
          const info = await fs.lstat(current);

          if (info.isSymbolicLink()) {
            throw new Error("Symlink paths are not allowed.");
          }

          if (!info.isDirectory()) {
            throw new Error("Parent path is not a directory.");
          }
        } catch (error) {
          if (error.code === "ENOENT") break;
          throw error;
        }
      }
    }

    await git.add(safeFiles);
    const commit = await git.commit(message);

    return result({
      message: "Commit created.",
      repo,
      commit: commit.commit,
      summary: commit.summary
    });
  }
);

// --------------------------------------------------
// 12. Push a local branch to GitHub
// --------------------------------------------------

server.registerTool(
  "git_push",
  {
    description: "Push a local branch to origin and set upstream tracking.",
    inputSchema: {
      repo: z.string(),
      branch: z.string()
    }
  },
  async ({ repo, branch }) => {
    validateBranch(branch);

    const git = await getGit(repo);
    const status = await git.status();

    if (status.current !== branch) {
      throw new Error(
        `Currently on '${status.current}'. Switch to '${branch}' first.`
      );
    }

    await git.push("origin", branch, ["--set-upstream"]);

    return result({
      message: "Push completed.",
      repo,
      branch
    });
  }
);

// --------------------------------------------------
// 13. Start the MCP server over standard I/O
// --------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);

