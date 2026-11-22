import crypto from "node:crypto";
import { formatTranslationHeader } from "../i18n.js";

function sha256(text) {
  return crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function stamp(sourceName, masterText, locale, translatedBody) {
  const header = formatTranslationHeader({
    source: sourceName,
    sha256: sha256(masterText),
    locale,
  });
  return `${header}\n\n${translatedBody}`;
}

export function generateSkeletonDocs({ projectName, contextName, contextCode, locale = "en" }) {
  const C = contextCode;
  const files = {};

  const ulMaster = `# Ubiquitous Language — ${contextName}

> Single Bounded Context repository: **${projectName}** (\`${contextName}\`, \`${C}\`)
> Every term defined here MUST match identifiers in OpenSpec specs, domain code, and tests.

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| \`Result<T, E>\` | Explicit success (\`Ok\`) or typed failure (\`Err\`) | Domain Shared | All expected errors are values |
| \`HealthStatus\` | Operational status of this Bounded Context service | Domain Value Object | Under \`domain/health/\` |
| \`DomainError\` | Typed domain/infrastructure error union | Domain Error | Under \`domain/health/\` |
| \`ClockPort\` | Port reading current ISO timestamp | Domain Port | Implemented in \`infrastructure/persistence/health/\` |
| \`GetHealthUseCase\` | Query use case returning \`HealthStatus\` | Application Query | Under \`application/health/queries/\` |
`;

  const cmMaster = `# Context Map — ${contextName}

- **Owned Bounded Context**: \`${contextName}\` (\`${C}\`, repository: \`${projectName}\`)
- **Cross-Repository OpenSpec Federation**: \`T.B.D.\`

## External Context Relationships

| Upstream / External Context | Repository | Relationship / Pattern | Application / ACL Port | Status |
| :--- | :--- | :--- | :--- | :--- |
| *(Add external Bounded Contexts here as ACL ports are introduced)* | Separate Repository | ACL / Customer-Supplier | \`application/shared/\` | \`T.B.D.\` |
`;

  const specMaster = `# ${contextName}/health Specification

## Purpose

Provides health status reporting for the ${contextName} Bounded Context, returning typed \`Result<T, E>\` failures when the underlying clock is unavailable.

## Requirements

### Requirement: REQ-${C}-001 Report service health status
The system SHALL evaluate the current timestamp via \`ClockPort\` and return \`HealthStatus\` on success or \`DomainError\` on failure.

#### Scenario: SCN-${C}-001-01 Service reports healthy status
- **GIVEN** the clock driver returns a valid ISO timestamp
- **WHEN** a user requests the service health status
- **THEN** the system returns \`HealthStatus\` and renders the healthy status page

#### Scenario: SCN-${C}-001-02 Service reports clock unavailable
- **GIVEN** the clock driver fails or returns an empty timestamp
- **WHEN** a user requests the service health status
- **THEN** the system returns \`CLOCK_UNAVAILABLE\` and renders the service unavailable page
`;

  const unitDomainMaster = `# Unit Test Specification — domain/health

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| \`UT-${C}-001\` | \`createHealthStatus\` | Equivalence partitioning | Valid trimmed ISO timestamp | \`Ok(HealthStatus)\` | \`REQ-${C}-001\` | \`tests/unit/domain_application\` |
| \`UT-${C}-002\` | \`createHealthStatus\` | Boundary value (empty) | Whitespace-only timestamp | \`Err(INVALID_TIMESTAMP)\` | \`REQ-${C}-001\` | \`tests/unit/domain_application\` |
`;

  const unitInfraMaster = `# Unit Test Specification — infrastructure/persistence/health

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| \`UT-${C}-003\` | \`mapRawTimestamp\` | Equivalence partitioning | Valid and blank strings | \`Ok\` / \`Err(CLOCK_UNAVAILABLE)\` | \`REQ-${C}-001\` | \`tests/unit/infrastructure\` |
| \`UT-${C}-004\` | \`SystemClockAdapter\` | Mock driver failure | Driver returns ISO / throws I/O error | \`Ok\` / \`Err(CLOCK_UNAVAILABLE)\` | \`SCN-${C}-001-02\` | \`tests/unit/infrastructure\` |
`;

  const unitAppMaster = `# Unit Test Specification — application/health

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| \`UT-${C}-005\` | \`CheckHealthService\` | Scenario 1-to-1 | Mock \`ClockPort\` returns \`Ok\` | \`Ok(HealthStatus)\` | \`SCN-${C}-001-01\` | \`tests/unit/domain_application\` |
| \`UT-${C}-006\` | \`CheckHealthService\` | Scenario 1-to-1 | Mock \`ClockPort\` returns \`Err\` | \`Err(CLOCK_UNAVAILABLE)\` | \`SCN-${C}-001-02\` | \`tests/unit/domain_application\` |
`;

  const unitPresMaster = `# Unit Test Specification — presentation/web/health

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| \`UT-${C}-007\` | Web UI Health & Error Views | Headless browser branch | Mock UseCase \`Ok\`, \`Err\`, and unknown route \`/missing\` | Expected DOM text, localized catalog & \`<html lang>\`, 404 view | \`REQ-${C}-001\` | \`tests/unit/presentation.browser\` |
`;

  const intMaster = `# Integration Test Specification — ${contextName}/health

## Test Cases

| ID | Title | Traces (SCN) | Technique | Preconditions (GIVEN) | Steps (WHEN) | Expected (THEN) | Priority | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| \`IT-${C}-001\` | End-to-end health check | \`SCN-${C}-001-01\` | Scenario E2E | Real \`drivers/clock\` and \`main\` wired | Request \`/\` on running artifact | Healthy status rendered for \`${contextName}\` | P1 | \`scripts/test-integration.sh\` |
| \`IT-${C}-002\` | Clock unavailable / not-found handling | \`SCN-${C}-001-02\` | Error guessing | Real artifact running | Request unknown route or simulated failure | Localized error / 404 response | P2 | \`scripts/test-integration.sh\` |

## Abnormal-Path Checklist

| Category | Case IDs | N/A Reason |
| :--- | :--- | :--- |
| Input boundary & invalid values | | Health check endpoint accepts no user input parameters |
| Invalid state transition | | Stateless read-only health query |
| External dependency failure (timeout / declined / unavailable) | \`IT-${C}-002\` | |
| Persistence / storage failure | | No persistent storage in health skeleton |
| Duplicate / concurrent conflict | | Read-only idempotent query |
| Target not found | \`IT-${C}-002\` | |
| Locale-specific rendering | \`IT-${C}-001\` | |
`;

  files["docs/domain/ubiquitous-language.md"] = ulMaster;
  files["docs/domain/context-map.md"] = cmMaster;
  files[`openspec/specs/${contextName}/health/spec.md`] = specMaster;
  files["docs/testing/unit/domain/health.md"] = unitDomainMaster;
  files["docs/testing/unit/infrastructure/health.md"] = unitInfraMaster;
  files["docs/testing/unit/application/health.md"] = unitAppMaster;
  files["docs/testing/unit/presentation/health.md"] = unitPresMaster;
  files["docs/testing/integration/health.md"] = intMaster;

  if (locale && locale !== "en") {
    files[`docs/domain/ubiquitous-language.${locale}.md`] = stamp(
      "ubiquitous-language.md",
      ulMaster,
      locale,
      `# ユビキタス言語 (${locale}) — ${contextName}\n\n` +
        `> 単一境界づけられたコンテキスト: **${projectName}** (\`${contextName}\`, \`${C}\`)\n\n` +
        ulMaster.split("\n").slice(5).join("\n")
    );
    files[`docs/domain/context-map.${locale}.md`] = stamp(
      "context-map.md",
      cmMaster,
      locale,
      `# コンテキストマップ (${locale}) — ${contextName}\n\n` +
        cmMaster.split("\n").slice(2).join("\n")
    );
    files[`openspec/specs/${contextName}/health/spec.${locale}.md`] = stamp(
      "spec.md",
      specMaster,
      locale,
      specMaster
    );
    files[`docs/testing/unit/domain/health.${locale}.md`] = stamp(
      "health.md",
      unitDomainMaster,
      locale,
      unitDomainMaster
    );
    files[`docs/testing/unit/infrastructure/health.${locale}.md`] = stamp(
      "health.md",
      unitInfraMaster,
      locale,
      unitInfraMaster
    );
    files[`docs/testing/unit/application/health.${locale}.md`] = stamp(
      "health.md",
      unitAppMaster,
      locale,
      unitAppMaster
    );
    files[`docs/testing/unit/presentation/health.${locale}.md`] = stamp(
      "health.md",
      unitPresMaster,
      locale,
      unitPresMaster
    );
    files[`docs/testing/integration/health.${locale}.md`] = stamp(
      "health.md",
      intMaster,
      locale,
      intMaster
    );
  }

  return files;
}
