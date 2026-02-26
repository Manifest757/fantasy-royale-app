# Fantasy Royale

## Overview

Fantasy Royale is a mobile-first fantasy sports contest platform where users can participate in free sponsored contests, earn rewards, and compete for prizes. The platform integrates a social feed, live sports news, and an e-commerce store, alongside a comprehensive gamification system that includes avatar customization, room building, and an admin content management system. The project aims to deliver an engaging and interactive experience for fantasy sports enthusiasts, leveraging a robust backend and a dynamic frontend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The application is built with Expo SDK 54, React Native 0.81, and React 19, utilizing `expo-router` v6 for typed file-based navigation. It features tab-based navigation across six main sections (Home, Contests, Stats, Talk, News, Merch) and modal-based screens for user profiles, contest details, and product views. The UI/UX incorporates a theming system with light/dark modes, platform-adaptive components, animated backgrounds using `react-native-reanimated`, and haptic feedback. State management relies on React Query for server state caching, React Context for local app state, and AsyncStorage for persistent local data.

### Backend Architecture

The backend is powered by Express.js 5 with TypeScript, exposing API routes under `/api`. It is designed to be scalable with CORS configured for Replit domains. The database schema, defined using Drizzle ORM with PostgreSQL and Zod validation, supports user management, contest mechanics, and a comprehensive gamification system. An `IStorage` interface abstracts data operations, currently using `MemStorage` for development with a clear path to PostgreSQL.

### Data Flow Architecture

All data fetching goes through the Express server API (using `supabaseAdmin`) to avoid RLS and client-side auth issues:
- **Public endpoints** (no auth): `GET /api/contests`, `GET /api/products`, `GET /api/news`, `GET /api/videos`, `GET /api/promo-slides`, `GET /api/ticker-items`
- **Auth endpoints**: `GET /api/me/profile`, `PUT /api/me/profile`, `GET /api/me/contests`, `POST /api/me/avatar-upload`, `GET/PUT /api/me/preferences`, `GET /api/me/summary`
- Frontend hooks in `lib/supabase-data.ts` use `publicFetch()` and `authFetch()` helpers to call server endpoints
- User contests are tracked via `contest_entries` table (one row per user per contest) with `picks_json` (JSONB snapshot of all picks) and `tiebreaker_prediction` (integer)
- Auto-grading and scoring logic reads from `contest_entries.picks_json` as the authoritative source of user picks
- The `picks` table stores individual pick rows for legacy compatibility; `contest_entries` is the primary source for grading/standings
- `GET /api/contests/:contestId/entries` returns all entries with picks and user profiles for a contest

### Gamification System

A central gamification system manages a crown economy, ELO ranking, streaks, badges, giveaways, avatar customization, and room building. Server-side game logic handles crown awards, ELO updates (with tier progression), streak tracking, badge awarding, and contest scoring. Various API routes provide endpoints for user interactions, admin functionalities (e.g., content management, user moderation, contest grading), and player data synchronization. The system supports flexible unlock conditions and a rarity system for in-game items.

### User Profile & Settings

The profile area (app/profile.tsx) displays real-time stats from Supabase APIs (crowns, streak, badges, ELO, contests entered, wins). Five settings sub-screens are available:
- **Account Settings** (app/account-settings.tsx): Edit username, view email/member since, upload profile photo via expo-image-picker or use character avatar. Avatar uploads go through POST /api/me/avatar-upload to Supabase Storage 'avatars' bucket.
- **Notifications** (app/notifications-settings.tsx): 9 toggle switches for contest reminders, results, live game updates, giveaway alerts, badge awards, streak reminders, crown updates, social activity, marketing emails. Persisted via Supabase `user_preferences` table. Push notifications are sent via Expo Push API alongside in-app notifications.
- **Privacy** (app/privacy-settings.tsx): Profile visibility and activity sharing controls (7 toggles). Persisted via Supabase `user_preferences` table.
- **Help & Support** (app/help-support.tsx): FAQ accordion (8 questions), email contact, app version display.
- **Terms of Service** (app/terms-of-service.tsx): 12-section scrollable legal text.

### Contest Multi-Game Selection

Admins can select multiple games for a contest from the BallDontLie API game browser. Selected games are stored in the contest's `scoring_json` JSONB column as `{ games: [...] }`. The contest detail screen (`app/contest/[id].tsx`) dynamically renders matchup cards from these games, requiring users to pick a winner for every game before submitting. The `GET /api/contests/:contestId/games` endpoint returns resolved game data for a contest.

### Sponsor Portal & Brand Management

The sponsor portal (app/sponsor.tsx) is role-gated: only users with role='sponsor' in user_profiles can access it. Non-sponsors see an "Access Denied" screen. Sponsors are created and managed exclusively by admins through the admin dashboard's "Sponsors" tab.

**Admin Sponsors Tab** (in app/admin.tsx): Full CRUD for brand sponsors with:
- List view showing all registered brands with status badges (approved/pending/suspended)
- Add/edit form with company name, email, website, description, brand color picker, business type, city, state
- User linking: associate a user ID to grant them sponsor portal access (sets their role to 'sponsor')
- Resource management: upload images/videos for each brand to Supabase Storage ('sponsor-resources' bucket)
- Delete brands with automatic role cleanup (linked user's role reverts to 'user')

**Backend Routes** (server/sponsor-routes.ts):
- `POST /api/admin/sponsors` — Create brand (auto-sets user role to 'sponsor' if user_id provided)
- `PUT /api/admin/sponsors/:id` — Edit brand (handles user role swaps)
- `DELETE /api/admin/sponsors/:id` — Delete brand (reverts linked user role)
- `POST/GET/DELETE /api/admin/sponsors/:id/resources` — Upload/list/delete brand resources in Supabase Storage

**Sponsor Portal Access Flow**:
1. User navigates to /sponsor
2. Backend checks user_profiles.role — if not 'sponsor', returns 404
3. If role='sponsor', auto-creates/retrieves sponsor_profiles entry
4. Approved sponsors see the full 11-view dashboard (campaigns, analytics, marketing, etc.)

### Automated Contest Lifecycle

The system supports a full automated contest lifecycle:
1. **Auto-Grading** (`POST /api/admin/contests/:contestId/auto-grade`): Fetches final game results from BallDontLie API, compares user picks against actual winners, grades all picks, and updates ELO ratings.
2. **Full Conclude** (`POST /api/admin/contests/:contestId/full-conclude`): One-button endpoint that auto-grades → computes scores/rankings → awards placement crowns → awards badges → sends result notifications → sets status to 'concluded'.
3. **Standings** (`GET /api/contests/:contestId/standings`): Returns ranked leaderboard with user profiles (username, avatar, score, rank). Displayed in the contest detail screen.
4. **Winner Notifications**: After concluding, each participant receives a notification with their placement, score, and crowns earned.

### Push Notification System

The app uses Expo Push Notifications for real-time alerts on physical devices (not web). Key components:
- **Frontend** (`lib/push-notifications.ts`): `usePushNotifications()` hook registered in `app/_layout.tsx` — requests permission, gets Expo push token, sends to backend, handles incoming notifications and deep-link navigation.
- **Backend** (`server/push-notifications.ts`): Utility functions for sending via Expo Push API (`https://exp.host/--/api/v2/push/send`), with single and bulk send, user preference checking, and category-based opt-out.
- **Token storage**: `user_profiles.push_token` column. Routes: `POST /api/me/push-token`, `DELETE /api/me/push-token`.
- **Integration**: Every in-app notification created via `gamificationService.createNotification()` automatically triggers a push notification, respecting user preference toggles. Bracket contest conclude also sends personalized placement push notifications.
- **Categories mapped to preferences**: CROWN_AWARD→crown_updates, BADGE_AWARD→badge_awards, CONTEST_RESULT→results, GIVEAWAY_WIN→giveaway_alerts, STREAK→streak_reminders, REFERRAL→social_activity.
- **Pending SQL**: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS push_token text;` and `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notif_live_game_updates boolean DEFAULT true;`

### Build System

Development uses Expo Metro for React Native and `tsx` for direct TypeScript server execution. Production builds involve a custom static web export script and `esbuild` for server bundling, with Drizzle Kit for database migrations.

## External Dependencies

### Core Services
- **Supabase**: Used as the primary Backend-as-a-service for database, authentication, storage, and security.
- **Replit Hosting**: The deployment platform for the application.

### Third-Party Packages
- **expo-image**: High-performance image rendering.
- **expo-linear-gradient**: For gradient backgrounds and UI elements.
- **react-native-reanimated**: Facilitates complex animations.
- **react-native-gesture-handler**: Provides comprehensive touch gesture handling.
- **react-native-screens**: Offers native navigation primitives.
- **@expo-google-fonts/inter**: Integrates the Inter font family.
- **@expo/vector-icons**: Provides Ionicons and Feather icon sets.
- **expo-notifications**: Push notification registration, handling, and display.

### Data Layer
- **@supabase/supabase-js**: The client library for interacting with Supabase services.
- **@react-native-async-storage/async-storage**: Used for session persistence, especially for Supabase authentication.
- **drizzle-orm**: TypeScript ORM for PostgreSQL.
- **pg**: PostgreSQL client.
- **zod**: Utilized for schema validation.