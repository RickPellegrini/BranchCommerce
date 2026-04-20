/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/jest/**/*.test.js"],
  coverageDirectory: "coverage-jest",
  collectCoverageFrom: ["__tests__/jest/**/*.js"],
}

export default config
