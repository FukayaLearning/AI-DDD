// Reference Vitest configuration enforcing 100% C1 coverage outside authorized exclusions.
export default {
  test: {
    coverage: {
      provider: "istanbul",
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["src/infrastructure/drivers/**", "src/main.ts"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
};
