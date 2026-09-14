export class UserEmailConflictError extends Error {
  constructor() {
    super("A user with that email already exists.");
    this.name = "UserEmailConflictError";
  }
}
