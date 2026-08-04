# Contribution Workflow

- Keep `feature/1-project-foundation` as integration branch. Create issue branches from it using `feature/1-project-foundation/<issue-number>-<short-slug>`; merge them back through pull requests.
- Push new branches with `git push -u origin <branch-name>` once. Later pushes use `git push`.
- Link code to GitHub issues in commits or pull requests with `(#<issue-number>)` or `Refs #<issue-number>`; use `Closes #<issue-number>` only when final changes reach `main`.
