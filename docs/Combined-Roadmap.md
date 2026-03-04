# Stashly Combined Roadmap

This document combines the high-level product roadmap with the detailed technical roadmap to provide a comprehensive overview of the Stashly project.

## Project Structure Overview

```
.
├── app/                     # Main application folder
│   ├── .client/             # Client-side specific logic
│   ├── .server/             # Server-side logic (API, auth, etc.)
│   ├── assets/              # Static assets like images and icons
│   ├── auth/                # Authentication related components and logic
│   ├── components/          # UI components specific to the main app
│   ├── hooks/               # Custom React hooks
│   ├── machines/            # XState state machines for complex UI logic
│   ├── prisma/              # Prisma client generation for browser
│   ├── routes/              # Application routes/pages
│   ├── styles/              # Global and shared styles
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── components/              # Shared, reusable UI components across the app
│   ├── comments-panel.tsx   # Component for displaying comments
│   ├── file-card.tsx        # Component for a single file card
│   ├── file-grid.tsx        # Component for a grid of files
│   ├── file-list-item.tsx   # Component for a file in a list view
│   ├── file-manager.tsx     # Main file manager component
│   ├── file-preview.tsx     # Component for previewing a file
│   ├── folder-card.tsx      # Component for a single folder card
│   ├── settings-page.tsx    # Component for the settings page
│   ├── share-folder-modal.tsx # Modal for sharing folders
│   ├── sidebar.tsx          # Sidebar component
│   └── storage-panel.tsx    # Component for showing storage info
├── docs/                    # Project documentation
│   ├── api/                 # API documentation
│   ├── architecture/        # Architecture documents
│   └── workflows/           # Workflow documentation
├── hooks/                   # Global custom React hooks
│   └── use-mobile.ts        # Hook to detect mobile viewport
├── prisma/                  # Database configuration
│   ├── migrations/          # Database migration history
│   ├── models/              # Data models (likely generated)
│   ├── seedData/            # Data for seeding the database
│   └── schema.prisma        # The single source of truth for your database schema
├── public/                  # Publicly accessible files
│   ├── .well-known/         # Standard well-known URIs
│   └── favicon.ico          # Application favicon
├── scripts/                 # Automation and utility scripts
│   ├── apply-index-settings.ts # Script to configure Algolia index
│   ├── gen.ts               # General purpose generation script
│   ├── generate.ts          # Data generation script
│   └── push-to-algolia.ts   # Script to push data to Algolia
├── server/                  # Backend server (likely Express.js)
│   ├── adapters/            # Adapters for external services
│   ├── middleware/          # Server middleware
│   └── plugins/             # Server plugins
├── tests/                   # Test files
│   ├── e2e/                 # End-to-end tests
│   ├── integration/         # Integration tests
│   └── unit/                # Unit tests
├── .github/                 # GitHub specific configuration
│   ├── instructions/        # Copilot instructions
│   └── prompts/             # Prompts for code generation
├── package.json             # Defines project dependencies and scripts
├── vite.config.ts           # Configuration file for Vite bundler
└── server.js                # Main entry point for the server
```

---

## Phase 1: Foundation & Core Functionality (MVP)

This phase focuses on establishing the basic features for a functional file storage application and a robust foundation for the file management system with a focus on core architecture, state management, and basic UI components.

- [x] **User Authentication:** Secure user sign-up, login, and password management.
- [x] **Dashboard UI:** A central dashboard to display user's files and storage usage.

### Folder Structure

```
app/
├── components/
│   ├── ui/                 # Reusable UI components (buttons, inputs, etc.)
│   ├── layouts/            # Page layouts and structural components
│   └── upload/             # File upload related components
├── machines/               # XState machines for complex workflows
│   ├── actors/             # Individual actor machines
│   └── types/              # Shared types for state machines
├── routes/                 # React Router route components
│   ├── api/                # API route handlers
│   └── auth/               # Authentication routes
├── .server/                # Server-side code (services, repositories)
│   ├── services/           # Business logic layer
│   ├── repositories/       # Data access layer
│   └── filters/            # Query filter builders
└── hooks/                  # Custom React hooks
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

This phase will focus on building the core file management capabilities. We'll implement a robust upload system that supports large files through multipart uploads, progress tracking, and pause/resume functionality. Storage quotas will be enforced, and users will be able to manage their files through a intuitive interface.

- [x] **File Uploads:** Ability to upload files, including large files using multipart uploads.
- [x] **File Storage:** Securely store files using a cloud provider (e.g., AWS S3).
- [x] **File Management:** View, organize, rename, and delete files.
- [x] **Basic Subscription:** Integration with Stripe for basic subscription plans.
- [x] **Storage Quotas:** Enforce storage limits based on user subscription plans.

### Folder Structure

```
app/
├── components/
│   ├── file-manager/       # File browsing and management UI
│   ├── upload/
│   │   ├── uploader.tsx    # Main file uploader component
│   │   ├── progress.tsx    # Upload progress indicators
│   │   └── queue.tsx       # Upload queue management
│   └── workspace/
│       ├── sidebar.tsx     # Workspace navigation
│       └── file-list.tsx   # File listing component
├── machines/
│   ├── upload.machine.ts   # Main upload orchestration machine
│   ├── file.machine.ts     # Individual file state management
│   ├── queue.machine.ts    # Upload queue management
│   └── quota.machine.ts    # Storage quota tracking
└── .server/
    ├── services/
    │   └── file.service.ts # File management business logic
    └── adapters/
        └── s3.adapter.ts   # S3 storage integration
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

This phase introduces features that allow users to collaborate and share their files with others. We'll create a permissions system to control access levels (view, edit, comment) and implement real-time collaboration features for shared workspaces.

- [ ] **File & Folder Sharing:** Generate shareable links for files and folders.
- [ ] **Link Permissions:** Set permissions for shared links (e.g., view-only, with password, expiration dates).
- [ ] **Team Workspaces:** Create shared workspaces for teams to collaborate on files.
- [ ] **User Invitations:** Invite users to collaborate in a workspace via email.
- [ ] **Commenting:** Add comments to files for feedback and discussion.
- [ ] **Version History:** Keep track of file versions and allow users to restore previous versions.

### Folder Structure

```
app/
├── components/
│   ├── sharing/            # Sharing UI components
│   │   ├── share-modal.tsx # Share file/folder modal
│   │   └── permissions.tsx # Permissions management
│   └── workspace/
│       ├── shared-items.tsx # Shared files view
│       └── activity-feed.tsx # Collaboration activity
├── routes/
│   └── shared/             # Routes for shared content
├── .server/
│   ├── services/
│   │   ├── share.service.ts # Sharing business logic
│   │   └── permission.service.ts # Permissions management
│   └── repositories/
│       └── share.repository.ts # Share data access
└── machines/
    └── share.machine.ts    # Sharing workflow management
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

This phase aims to enhance the user experience with intelligent features and better integrations. We'll implement file versioning to track changes, add powerful search capabilities, and optimize the system for better performance and scalability.

- [ ] **Advanced Search:** Implement semantic search using Algolia to search within file content (for supported formats like .txt, .md, .pdf).
- [ ] **AI-powered Organization:** Automatically categorize and tag files based on their content.
- [ ] **Desktop Sync Client:** Develop a desktop application to sync files between the user's computer and Stashly.
- [ ] **Mobile App (iOS & Android):** Native mobile applications for accessing files on the go.
- [ ] **Third-party Integrations:** Integrate with popular services like Google Drive, Dropbox, Slack, and Zapier.
- [ ] **Public API:** Expose a public API for developers to build integrations with Stashly.

### Folder Structure

```
app/
├── components/
│   ├── search/             # Search UI components
│   │   ├── search-bar.tsx  # Search input component
│   │   └── results.tsx     # Search results display
│   └── versioning/         # File versioning UI
│       ├── history.tsx     # Version history view
│       └── compare.tsx     # Version comparison
├── .server/
│   ├── services/
│   │   ├── search.service.ts # Search business logic
│   │   └── version.service.ts # File versioning logic
│   └── repositories/
│       └── version.repository.ts # Version data access
└── machines/
    └── search.machine.ts   # Search workflow management
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

This phase focuses on expanding the monetization options and driving user growth, and providing valuable insights through analytics and reporting.

- [ ] **Tiered Subscription Plans:** Introduce multiple subscription tiers with different features and storage limits (e.g., Free, Pro, Business).
- [ ] **Pay-as-you-go:** Offer options for purchasing additional storage or features on a one-time basis.
- [ ] **Referral Program:** Implement a referral program to incentivize user growth.
- [ ] **Affiliate Program:** Create an affiliate program for partners to promote Stashly.
- [ ] **Analytics Dashboard:** Provide users with detailed analytics on their file usage and sharing.

### Folder Structure

```
app/
├── components/
│   └── analytics/          # Analytics dashboard components
│       ├── charts/         # Chart components for data visualization
│       ├── reports/        # Report generation UI
│       └── metrics/        # Key metrics display
├── routes/
│   └── analytics/          # Analytics dashboard routes
├── .server/
│   ├── services/
│   │   └── analytics.service.ts # Analytics business logic
│   └── repositories/
│       └── analytics.repository.ts # Analytics data access
└── machines/
    └── analytics.machine.ts # Analytics workflow management
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

This phase introduces features tailored for enterprise customers and larger teams.

- [ ] **Single Sign-On (SSO):** Support for SSO providers like Okta, Auth0, and SAML.
- [ ] **Advanced Admin Controls:** Granular control over team members, permissions, and security settings.
- [ ] **Audit Logs:** Detailed logs of all activities within the workspace for security and compliance.
- [ ] **Data Residency Options:** Allow enterprise customers to choose the geographic region where their data is stored.
- [ ] **Service Level Agreements (SLAs):** Offer SLAs for uptime and support for enterprise customers.

---

## Future Ideas

A collection of ideas that could be explored in the future.

- [ ] **Real-time Document Editing:** Integrate a collaborative document editor like Etherpad or build a custom one.
- [ ] **Encrypted Vaults:** Offer client-side encrypted folders for maximum security.
- [ ] **Blockchain Integration:** Explore using blockchain for file verification and decentralized storage options.
- [ ] **NFT Support:** Allow users to store and manage NFTs.
