/** @type {import('@hey-api/openapi-ts').UserConfig} */
export default {
  input: "./server/openapi.yaml",
  output: "./client/src/generated/hey-api",
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/sdk",
    "@hey-api/typescript",
    "@tanstack/react-query",
  ],
};
