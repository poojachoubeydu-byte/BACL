# Security Policy

## Supported versions

BCAL follows semver. Only the latest minor of each major release receives
security fixes. Schema-breaking changes bump the major version.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅         |

## Reporting a vulnerability

**Please do not file public GitHub issues for security reports.**

Email the maintainers (or open a private advisory via GitHub's
*Security → Advisories → Report a vulnerability*) with:

- A clear description of the issue and its impact.
- Steps to reproduce (a minimal SEP, a crafted input, or a command).
- Any proof-of-concept code.
- Whether the issue affects integrity of the audit trail (high priority)
  or the dashboard (medium priority).

We acknowledge reports within 3 business days and publish a fix within
30 days for high-severity integrity issues.

## What counts as a security issue

BCAL's security model centres on the **integrity of the audit trail**:

| Category | Severity |
|---|---|
| A tampered SEP passes `bcal verify` | Critical |
| An exclusion, subgroup, or outlier can be silently altered | Critical |
| The seal hash can collide or be forged | Critical |
| An API key is exposed to the client bundle | High |
| A regulatory profile can be substituted without audit | High |
| A crafted input causes arbitrary file read/write | High |
| A crafted input crashes the CLI (DoS) | Medium |
| A dependency has a known CVE we haven't patched | Medium |

## Known non-issues

The following are **out of scope** because they describe intended behaviour:

- The LLM-enhanced reviewer language is non-deterministic. Reviewers should
  only sign the template-rendered (default) narrative.
- `bcal verify` validates integrity of a SEP against its own seal, not
  against the original pipeline run. Pipeline reproducibility requires
  running the pipeline under identical conditions — BCAL records the
  conditions but does not re-execute them.
