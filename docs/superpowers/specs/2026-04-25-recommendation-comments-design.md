# Awesome IWB: Recommendation & Review System Design

## 1. Overview
The goal is to elevate the Awesome IWB web application to an "App Store" caliber experience. This involves implementing two major feature sets:
1. **Dual Recommendation System**: A highly visual, App Store-style "Today" tab for historical editorial features, combined with a Hero Carousel on the Home page for the latest highlights.
2. **Dual Comment/Review System**: A combination of curated editorial reviews (parsed from Markdown) and open community discussions (powered by GitHub).

## 2. Recommendation System Architecture

### 2.1 Home Page Hero Carousel (The "Latest" Highlights)
- **Component**: `HeroCarousel.vue` (to be created and embedded in `HomeView.vue`).
- **Data Source**: A curated list derived from the `data.json` where `recommendation` includes "🥇 非常推荐" or projects marked as new.
- **Visual Aesthetic**:
  - Full-width or wide-container cards at the top of the Home page.
  - Large banner images acting as the background.
  - Glassmorphism overlay with bold typography (App name, developer, and a short, punchy tagline).
  - Smooth sliding animations (CSS-based or using a lightweight library like Swiper/Embla if necessary, though CSS scroll-snap is preferred for zero dependencies).

### 2.2 Dedicated "Today" Tab (The Editorial Archive)
- **Route**: `/featured` or `/today`
- **Component**: `FeaturedView.vue`
- **Visual Aesthetic**:
  - Mimics the Apple App Store "Today" tab.
  - Stacked, magazine-style cards. Each card tells a story (e.g., "The Best Whiteboard Apps for Teachers", "Meet the Developer: WXRIW").
  - Clicking a card opens a full-screen or modal article view, leading to specific project detail pages.
- **Data Source**: 
  - To maintain the zero-backend architecture, these editorial posts will be defined in a static JSON/JS file (e.g., `featured_stories.json` or `featured.ts`) within the frontend repository, referencing existing projects from `data.json`.

## 3. Comment & Review System Architecture

### 3.1 Curated Editorial Reviews (Markdown Parsing)
- **Current State**: Already implemented. `migrate.py` parses `💬 **XXX 锐评**` and outputs to `data.json`.
- **UI Enhancement**: In `ProjectDetailView.vue`, these reviews will be elevated to the top of the details page, styled with golden/amber accents or "Editors' Note" badges to distinguish them from regular community comments.

### 3.2 Community Discussions (GitHub Giscus Integration)
- **Tool**: [Giscus](https://giscus.app/) (A comments system powered by GitHub Discussions).
- **Implementation**:
  - Embed the Giscus script at the bottom of `ProjectDetailView.vue`.
  - The `term` (identifier) will be mapped dynamically to the `project.name` or `route.params.name`.
  - **Prerequisite**: The `awesome-iwb/awesome-iwb` repository must have the **Discussions** feature enabled, and the Giscus GitHub App must be installed on the repository.
- **Visual Aesthetic**: The Giscus widget naturally supports dark/light mode and will seamlessly blend into the bottom of the App Store detail view.

## 4. Technical Constraints & Trade-offs
- **Zero Backend**: All data remains static (`data.json`) or delegates to GitHub (Giscus). No database or authentication system is required to be maintained by the host.
- **Giscus Setup**: The user/admin will need to manually configure Giscus on their GitHub repository once, which will provide the `data-repo-id` and `data-category-id` required for the frontend script.

## 5. Implementation Plan (Next Steps)
1. **Design & Build `HeroCarousel.vue`**: Integrate it into the top of `HomeView.vue`.
2. **Create `FeaturedView.vue`**: Design the App Store "Today" tab layout and add a top navigation link.
3. **Integrate Giscus**: Add the community comment section to `ProjectDetailView.vue`.
4. **Refine UI**: Polish the editorial "锐评" to look like official App Store editor notes.
