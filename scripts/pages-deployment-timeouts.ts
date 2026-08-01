export const deploymentBuildTimeoutMs = 90_000
const deploymentCleanupBudgetMs = 5_000
export const deploymentTestTimeoutMs = deploymentBuildTimeoutMs + deploymentCleanupBudgetMs
