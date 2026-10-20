# Security Policy

## Reporting a vulnerability

Please use a private [GitHub Security Advisory](https://github.com/marquezinii/follow-audit/security/advisories/new) for vulnerabilities that could expose a session, reveal account data, bypass user confirmation, or perform an unintended action.

Include a minimal reproduction, affected commit, expected behavior, and impact. Remove cookies, CSRF tokens, usernames, profile data, and other personal information from every attachment and log.

## Security invariants

FollowAudit must never:

- persist or export session cookies or CSRF tokens;
- send account data to a project-controlled or third-party server;
- persist or upload selected TikTok export files;
- execute an account action without explicit confirmation;
- retry an unfollow or follower removal automatically;
- include protected accounts in the action queue;
- keep running the queue after a rate limit, a refusal response, or three consecutive failures;
- continue an active operation after cancellation;
- automate TikTok relationship changes;
- trust data read back from `localStorage` or imported files without validation.

The website ships a Content-Security-Policy that allows only same-origin resources and a single hashed inline script.

## Supported version

Security fixes target the current `main` branch. Private Instagram endpoints and TikTok export formats are outside the project's control and can change without notice.
