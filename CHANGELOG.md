# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Automated tests for ACL, flags, and plugin registration

## [4.0.0] - 2026-07-24

Major Baileys **7.0.0-rc13** rewrite on `main` (previous line preserved as `pre-v7`).

### Added

- Lean Baileys socket (no full history sync, offline on connect, safe reconnect)
- Dual auth: **better-sqlite3** (default) or **Postgres** via `DATABASE_URL`
- BotKV settings (mode, sudo, lang, sticker EXIF, group settings)
- System **log group** onboarding (`#setup`, `#createlog`, `#setlog`)
- Media plugins: stickers + EXIF, YouTube (`youtubei.js`), tools, social DLs
- Moderation: welcome/goodbye, antilink, antispam, warn/mute/kick
- Productivity: notes, reminders, polls
- Enterprise: audit, feature flags, RBAC, policies, metrics, job queue, backup
- Optional admin HTTP (`/health`, `/metrics`, `/audit`, …)
- Public/private bot mode and sudo ACL
- Multi-language strings (`en` / `id` / `hi`)

### Changed

- Command prefix and UX helpers (`#menu`, react-ack, typing)
- README rewritten for the v4 architecture

### Security

- User-facing errors stay generic; stacks go to the system log group only
- Spoof mitigations on `messages.upsert` (notify-only, ignore `requestId`)

[Unreleased]: https://github.com/Neeraj-x0/X-Asena/compare/v4.0.0...HEAD
[4.0.0]: https://github.com/Neeraj-x0/X-Asena/releases/tag/v4.0.0
