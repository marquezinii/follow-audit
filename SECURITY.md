# Security Policy

## Reporting a vulnerability

Please use a private [GitHub Security Advisory](https://github.com/marquezinii/follow-audit/security/advisories/new) for vulnerabilities that could expose a session, reveal account data, bypass user confirmation, or perform an unintended action.

Include a minimal reproduction, affected commit, expected behavior, and impact. Remove cookies, CSRF tokens, usernames, profile data, and other personal information from every attachment and log.

## Security invariants

Follow Audit must never:

- persist or export session cookies or CSRF tokens;
- send account data to a project-controlled server;
- execute an unfollow without explicit confirmation;
- retry an unfollow request automatically;
- include protected accounts in the action queue;
- continue an active operation after cancellation.

## Supported version

Security fixes target the current `main` branch. Private Instagram endpoints are outside the project's control and can change without notice.
