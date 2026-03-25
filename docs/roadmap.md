# Stashly Project Roadmap

## Overview

Stashly is a secure, intuitive, and powerful file storage and collaboration platform. This document outlines the full development roadmap, combining product goals, technical architecture, and a learner-friendly rationale for each phase.

---

## Project Structure

```
.
├── app/                     # Main application folder
│   ├── .client/             # Client-side specific logic
│   ├── .server/             # Server-side logic (API, auth, etc.)
│   ├── assets/              # Static assets
│   ├── auth/                # Authentication components and logic
│   ├── components/          # UI components
│   ├── hooks/               # Custom React hooks
│   ├── machines/            # XState state machines
│   ├── prisma/              # Prisma client generation for browser
│   ├── routes/              # Application routes/pages
│   ├── styles/              # Global and shared styles
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── components/              # Shared, reusable UI components
│   ├── comments-panel.tsx
│   ├── file-card.tsx
│   ├── file-grid.tsx
│   ├── file-list-item.tsx
│   ├── file-manager.tsx
│   ├── file-preview.tsx
│   ├── folder-card.tsx
│   ├── settings-page.tsx
│   ├── share-folder-modal.tsx
│   ├── sidebar.tsx
│   └── storage-panel.tsx
├── docs/                    # Project documentation
├── hooks/                   # Global custom React hooks
│   └── use-mobile.ts
├── prisma/                  # Database configuration
│   ├── migrations/
│   ├── models/
│   ├── seedData/
│   └── schema.prisma
├── public/                  # Publicly accessible files
├── scripts/                 # Automation and utility scripts
│   ├── apply-index-settings.ts
│   ├── gen.ts
│   ├── generate.ts
│   └── push-to-algolia.ts
├── server/                  # Backend server
│   ├── adapters/
│   ├── middleware/
│   └── plugins/
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── unit/
├── .github/
│   ├── instructions/
│   └── prompts/
├── package.json
├── vite.config.ts
└── server.js
```

---

## Phase 1: Foundation & Core Functionality (MVP)

**Why:** Build the Minimum Viable Product to launch, gather feedback, and validate the core idea without getting bogged down in complex features. A roadmap ensures focus, clarity, and motivation by breaking a large project into smaller milestones.

**Status:** Most features complete.

- [x] **User Authentication:** Secure user sign-up, login, and password management.
- [x] **File Uploads:** Ability to upload files, including large files using multipart uploads.
- [x] **File Storage:** Securely store files using AWS S3.
- [x] **File Management:** View, organize, rename, and delete files.
- [x] **Dashboard UI:** A central dashboard to display user's files and storage usage.
- [x] **Basic Subscription:** Integration with Stripe for basic subscription plans.
- [x] **Storage Quotas:** Enforce storage limits based on user subscription plans.

### Folder Structure

```
app/
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── layouts/            # Page layouts
│   └── upload/             # File upload components
├── machines/               # XState machines
│   ├── actors/
│   └── types/
├── routes/
│   ├── api/
│   └── auth/
├── .server/
│   ├── services/
│   ├── repositories/
│   └── filters/
└── hooks/
```

### Tasks

- [ ] Set up project with Vite, React, and TypeScript
- [ ] Configure React Router for application routing
- [ ] Implement authentication system with better-auth
- [ ] Create basic UI component library with Tailwind CSS
- [ ] Set up XState for state management
- [ ] Design and implement core application layout
- [ ] Create shared types and interfaces
- [ ] Set up development environment and tooling
- [ ] Implement basic error handling and logging
- [ ] Create project documentation and contribution guidelines

---

## Phase 2: File Management & Upload System

**Why:** Transform Stashly into a fully functional file management platform with robust upload capabilities, quota enforcement, and an intuitive UI.

- [x] **File Uploads** (multipart, large files)
- [x] **File Storage** (AWS S3)
- [x] **File Management** (view, organize, rename, delete)
- [x] **Storage Quotas** (XState-managed)

### Folder Structure

```
app/
├── components/
│   ├── file-manager/
│   ├── upload/
│   │   ├── uploader.tsx
│   │   ├── progress.tsx
│   │   └── queue.tsx
│   └── workspace/
│       ├── sidebar.tsx
│       └── file-list.tsx
├── machines/
│   ├── upload.machine.ts
│   ├── file.machine.ts
│   ├── queue.machine.ts
│   └── quota.machine.ts
└── .server/
    ├── services/
    │   └── file.service.ts
    └── adapters/
        └── s3.adapter.ts
```

### Tasks

- [ ] Design and implement file upload architecture
- [ ] Create multipart upload implementation for large files
- [ ] Develop upload progress tracking and visualization
- [ ] Implement upload queue management system
- [ ] Create file browsing and management UI
- [ ] Implement storage quota system with XState
- [ ] Build file preview capabilities for common file types
- [ ] Add file organization features (folders, tags)
- [ ] Implement file metadata extraction and storage
- [ ] Create responsive and accessible UI components

---

## Phase 3: Collaboration & Sharing

**Why:** Transform Stashly from a personal storage tool into a collaborative platform. The first step is sharing; the second is creating shared environments for teams.

- [ ] **File & Folder Sharing:** Generate shareable links for files and folders.
- [ ] **Link Permissions:** Set permissions for shared links (view-only, password, expiration dates).
- [ ] **Team Workspaces:** Create shared workspaces for teams.
- [ ] **User Invitations:** Invite users to collaborate via email.
- [ ] **Commenting:** Add comments to files for feedback and discussion.
- [ ] **Version History:** Keep track of file versions and allow restoring previous versions.

### Folder Structure

```
app/
├── components/
│   ├── sharing/
│   │   ├── share-modal.tsx
│   │   └── permissions.tsx
│   └── workspace/
│       ├── shared-items.tsx
│       └── activity-feed.tsx
├── routes/
│   └── shared/
├── .server/
│   ├── services/
│   │   ├── share.service.ts
│   │   └── permission.service.ts
│   └── repositories/
│       └── share.repository.ts
└── machines/
    └── share.machine.ts
```

### Tasks

- [ ] Design and implement file/folder sharing system
- [ ] Create permissions management interface
- [ ] Implement real-time collaboration features
- [ ] Build shared workspace functionality
- [ ] Add commenting and annotation features
- [ ] Create activity feed for collaboration tracking
- [ ] Implement notification system for shared items
- [ ] Add version history for collaborative documents
- [ ] Create audit logs for file access and changes
- [ ] Implement secure link sharing with expiration

---

## Phase 4: Advanced Features, Intelligence & Optimization

**Why:** Differentiate Stashly from basic storage providers by adding smart features that enhance user experience — advanced search, AI-powered organization, cross-platform access, and performance improvements.

- [ ] **Advanced Search:** Implement semantic search using Algolia to search within file content (.txt, .md, .pdf).
- [ ] **AI-powered Organization:** Automatically categorize and tag files based on their content.
- [ ] **Desktop Sync Client:** Develop a desktop application to sync files.
- [ ] **Mobile App (iOS & Android):** Native mobile applications.
- [ ] **Third-party Integrations:** Google Drive, Dropbox, Slack, Zapier.
- [ ] **Public API:** Expose a public API for developers.

### Folder Structure

```
app/
├── components/
│   ├── search/
│   │   ├── search-bar.tsx
│   │   └── results.tsx
│   └── versioning/
│       ├── history.tsx
│       └── compare.tsx
├── .server/
│   ├── services/
│   │   ├── search.service.ts
│   │   └── version.service.ts
│   └── repositories/
│       └── version.repository.ts
└── machines/
    └── search.machine.ts
```

### Tasks

- [ ] Implement file versioning and history tracking
- [ ] Create advanced search functionality with filters
- [ ] Add file comparison features for versions
- [ ] Implement performance optimizations for large file sets
- [ ] Add offline support for file access
- [ ] Create backup and restore functionality
- [ ] Implement data deduplication for storage optimization
- [ ] Add compression for file transfers
- [ ] Optimize database queries and indexing
- [ ] Implement caching strategies for improved performance

---

## Phase 5: Analytics, Monetization & Growth

**Why:** Build a sustainable business by expanding revenue streams and driving user growth, while giving users visibility into their own usage patterns.

- [ ] **Tiered Subscription Plans:** Free, Pro, Business tiers with different features and storage limits.
- [ ] **Pay-as-you-go:** Purchase additional storage or features on a one-time basis.
- [ ] **Referral Program:** Incentivize user growth.
- [ ] **Affiliate Program:** Partners to promote Stashly.
- [ ] **Analytics Dashboard:** Detailed analytics on file usage and sharing.

### Folder Structure

```
app/
├── components/
│   └── analytics/
│       ├── charts/
│       ├── reports/
│       └── metrics/
├── routes/
│   └── analytics/
├── .server/
│   ├── services/
│   │   └── analytics.service.ts
│   └── repositories/
│       └── analytics.repository.ts
└── machines/
    └── analytics.machine.ts
```

### Tasks

- [ ] Design and implement analytics dashboard
- [ ] Create storage usage reporting
- [ ] Implement user activity tracking
- [ ] Build file access and sharing analytics
- [ ] Add performance metrics monitoring
- [ ] Create customizable report generation
- [ ] Implement data export functionality
- [ ] Add real-time analytics updates
- [ ] Create admin-level system analytics
- [ ] Implement alerting for storage quotas and anomalies

---

## Phase 6: Enterprise & Teams

**Why:** Address the specific security, compliance, and administrative needs of large organizations, making Stashly a viable enterprise solution.

- [ ] **Single Sign-On (SSO):** Support for Okta, Auth0, and SAML.
- [ ] **Advanced Admin Controls:** Granular control over team members, permissions, and security.
- [ ] **Audit Logs:** Detailed logs of all activities for security and compliance.
- [ ] **Data Residency Options:** Let enterprise customers choose where their data is stored.
- [ ] **Service Level Agreements (SLAs):** Offer SLAs for uptime and support.

---

## Future Ideas

- [ ] **Real-time Document Editing:** Integrate a collaborative editor like Etherpad.
- [ ] **Encrypted Vaults:** Client-side encrypted folders for maximum security.
- [ ] **Blockchain Integration:** File verification and decentralized storage options.
- [ ] **NFT Support:** Store and manage NFTs.
