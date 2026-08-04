const commitTypes = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
] as const;

export default {
  extends: ["@commitlint/config-conventional"],
  parserPreset: {
    parserOpts: {
      headerCorrespondence: ["type", "scope", "subject"],
      headerPattern: /^(?<type>\w+)(?:\((?<scope>.*)\))?: (?<subject>.+)$/u,
    },
  },
  prompt: {
    questions: {
      body: {
        description: "Body is disabled for this repository. Leave this blank.",
      },
      breaking: {
        description:
          "Breaking changes are not supported by this commit format.",
      },
      breakingBody: {
        description:
          "Breaking changes are not supported by this commit format.",
      },
      footer: {
        description:
          "Footer is disabled for this repository. Leave this blank.",
      },
      isBreaking: {
        description:
          "Breaking changes are not supported by this commit format.",
      },
      isIssueAffected: {
        description: "Issue footers are disabled for this repository.",
      },
      issues: {
        description: "Issue footers are disabled for this repository.",
      },
      issuesBody: {
        description: "Issue footers are disabled for this repository.",
      },
      scope: {
        description: "Scope is disabled for this repository. Leave this blank.",
      },
      subject: {
        description:
          "Write a short, imperative tense description of the change",
      },
      type: {
        description: "Select the type of change that you're committing:",
        enum: {
          build: {
            description:
              "Changes that affect the build system or external dependencies",
            title: "Builds",
          },
          chore: {
            description: "Other changes that don't modify src or test files",
            title: "Chores",
          },
          ci: {
            description: "Changes to CI configuration files and scripts",
            title: "Continuous Integrations",
          },
          docs: {
            description: "Documentation only changes",
            title: "Documentation",
          },
          feat: {
            description: "A new feature",
            title: "Features",
          },
          fix: {
            description: "A bug fix",
            title: "Bug Fixes",
          },
          perf: {
            description: "A code change that improves performance",
            title: "Performance Improvements",
          },
          refactor: {
            description:
              "A code change that neither fixes a bug nor adds a feature",
            title: "Code Refactoring",
          },
          revert: {
            description: "Reverts a previous commit",
            title: "Reverts",
          },
          style: {
            description: "Changes that do not affect the meaning of the code",
            title: "Styles",
          },
          test: {
            description: "Adding missing tests or correcting existing tests",
            title: "Tests",
          },
        },
      },
    },
    settings: {
      enableMultipleScopes: false,
      useExclamationMark: false,
    },
  },
  rules: {
    "body-empty": [2, "always"],
    "footer-empty": [2, "always"],
    "header-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 72],
    "scope-empty": [2, "always"],
    "subject-empty": [2, "never"],
    "type-enum": [2, "always", [...commitTypes]],
  },
};
