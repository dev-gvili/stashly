# Stashly Roadmap

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
│   ├── gen.ts               # General purpose generation script
│   └── generate.ts          # Data generation script
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

This phase introduces features that allow users to collaborate and share their files with others.

- [ ] **File & Folder Sharing:** Generate shareable links for files and folders.
- [ ] **Link Permissions:** Set permissions for shared links (e.g., view-only, with password, expiration dates).
- [ ] **Team Workspaces:** Create shared workspaces for teams to collaborate on files.
- [ ] **User Invitations:** Invite users to collaborate in a workspace via email.
- [ ] **Commenting:** Add comments to files for feedback and discussion.
- [ ] **Version History:** Keep track of file versions and allow users to restore previous versions.

## Phase 3: Advanced Features & Intelligence

This phase aims to enhance the user experience with intelligent features and better integrations.

- [ ] **Advanced Search:** Implement semantic search using pgvector to search within file content (for supported formats like .txt, .md, .pdf).
- [ ] **AI-powered Organization:** Automatically categorize and tag files based on their content.
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
- [ ] **Audit Logs:** Detailed logs of all activities within the workspace for security and compliance.
- [ ] **Data Residency Options:** Allow enterprise customers to choose the geographic region where their data is stored.
- [ ] **Service Level Agreements (SLAs):** Offer SLAs for uptime and support for enterprise customers.

## Future Ideas

A collection of ideas that could be explored in the future.

- [ ] **Real-time Document Editing:** Integrate a collaborative document editor like Etherpad or build a custom one.
- [ ] **Encrypted Vaults:** Offer client-side encrypted folders for maximum security.
- [ ] **Blockchain Integration:** Explore using blockchain for file verification and decentralized storage options.
- [ ] **NFT Support:** Allow users to store and manage NFTs.
