# Stashly Roadmap

> **This is the *product* roadmap — the feature phases, in rough priority order.**
> For engineering status (what has actually shipped, what is stubbed, what is
> mid-flight) see [`docs/roadmap.md`](docs/roadmap.md), which is the source of
> truth whenever the two disagree. For the real directory layout see
> [`README.md`](README.md#project-structure).
>
> Phase statuses below were re-checked against the code on 2026-08-14. Items
> marked partial have a working backend with no UI yet — those are tracked in
> detail in the engineering roadmap.

This document outlines the development roadmap for Stashly. Our goal is to build a secure, intuitive, and powerful file storage and collaboration platform.

## Phase 1: Core Functionality (MVP)

This phase focuses on establishing the basic features for a functional file storage application. Most of these features are already implemented.

- [x] **User Authentication:** Secure user sign-up, login, and password management.
- [x] **File Uploads:** Ability to upload files, including large files using multipart uploads.
- [x] **File Storage:** Securely store files using a cloud provider (e.g., AWS S3).
- [x] **File Management:** View, organize, rename, and delete files.
- [x] **Dashboard UI:** A central dashboard to display user's files and storage usage.
- [x] **Basic Subscription:** Integration with Stripe for basic subscription plans.
- [x] **Storage Quotas:** Enforce storage limits based on user subscription plans.

## Phase 2: Collaboration & Sharing

This phase introduces features that allow users to collaborate and share their files with others. `[~]` marks a feature whose backend is done but which has no UI yet.

- [x] **File & Folder Sharing:** Generate shareable links for files and folders. *(`share-actions.ts`, `/api/shares`, `ShareDialog`, shared-with-me view)*
- [x] **Link Permissions:** Set permissions for shared links. *(read/write scopes; password and expiry are not implemented)*
- [x] **User Invitations:** Invite users to collaborate via email. *(`invitation-actions.ts`, `/api/invitations`, received/sent views, invite flow covering files, folders and workspaces)*
- [~] **Team Workspaces:** Create shared workspaces for teams. *(schema, membership backend and the `/:me/workspaces/:workspaceId/*` route space exist; the detail page renders, but most workspace views are still stubs)*
- [~] **Commenting:** Add comments to files for feedback. *(backend only — `comment-actions.ts` + `/api/comments`; no UI is mounted)*
- [~] **Version History:** Track file versions and restore previous ones. *(backend only — `version-actions.ts` + `/api/versions`; no UI to view, create or restore)*
- [x] **Activity History:** Timeline of item events. *(not originally planned here — `/api/activities`, `ActivityFeed`, `ItemActivityDrawer`)*
- [x] **Live Notifications:** Real-time in-app notification feed. *(SSE over Postgres LISTEN/NOTIFY; the `/settings/notifications` preferences page is still a stub)*

## Phase 3: Advanced Features & Intelligence

This phase aims to enhance the user experience with intelligent features and better integrations.

- [x] **Advanced Search:** Semantic search over file content using pgvector. *(text extracted server-side, chunked ~300 tokens with overlap, embedded in the browser on WebGPU; unembedded chunks are healed on a later visit. See [semantic-search.md](docs/semantic-search.md))*
- [~] **AI-powered Organization:** Automatically categorize and tag files by content. *(the pipeline produces captions, transcripts, keywords and tags; nothing yet files or organizes items automatically off the back of them)*
- [ ] **Desktop Sync Client:** Develop a desktop application to sync files between the user's computer and Stashly.
- [ ] **Mobile App (iOS & Android):** Native mobile applications for accessing files on the go.
- [ ] **Third-party Integrations:** Integrate with popular services like Google Drive, Dropbox, Slack, and Zapier.
- [ ] **Public API:** Expose a public API for developers to build integrations with Stashly.

## Phase 4: Monetization & Growth

This phase focuses on expanding the monetization options and driving user growth.

- [ ] **Tiered Subscription Plans:** Introduce multiple subscription tiers with different features and storage limits (e.g., Free, Pro, Business).
- [ ] **Pay-as-you-go:** Offer options for purchasing additional storage or features on a one-time basis.
- [ ] **Referral Program:** Implement a referral program to incentivize user growth.
- [ ] **Affiliate Program:** Create an affiliate program for partners to promote Stashly.
- [ ] **Analytics Dashboard:** Provide users with detailed analytics on their file usage and sharing.

## Phase 5: Enterprise & Teams

This phase introduces features tailored for enterprise customers and larger teams.

- [ ] **Single Sign-On (SSO):** Support for SSO providers like Okta, Auth0, and SAML.
- [ ] **Advanced Admin Controls:** Granular control over team members, permissions, and security settings.
- [~] **Audit Logs:** Detailed logs of all activity for security and compliance. *(an `AuditLog` model exists in the schema but has no action file and nothing writes to it; the user-facing activity timeline is a separate feature)*
- [ ] **Data Residency Options:** Allow enterprise customers to choose the geographic region where their data is stored.
- [ ] **Service Level Agreements (SLAs):** Offer SLAs for uptime and support for enterprise customers.

## Future Ideas

A collection of ideas that could be explored in the future.

- [ ] **Real-time Document Editing:** Integrate a collaborative document editor like Etherpad or build a custom one.
- [ ] **Encrypted Vaults:** Offer client-side encrypted folders for maximum security.
- [ ] **Blockchain Integration:** Explore using blockchain for file verification and decentralized storage options.
- [ ] **NFT Support:** Allow users to store and manage NFTs.
