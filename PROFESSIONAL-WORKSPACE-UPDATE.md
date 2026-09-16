# Commissioner — professional workspace update

Applied on top of the 2026-09-11 build. Polish and role safety only — no rebuild,
no schema change, no new dependencies. `vite build` passes.

## 1. Fixed navigation hierarchy
Signed-in main nav, always in this order, always in the same place:
Dashboard · Find creators (business) / Find businesses (creator) · Marketplace ·
B2B network · Messages · Trust & verification · Plans.

- Proper lucide UI icons on every nav item, desktop and mobile. No emoji.
- Consistent B2B network naming everywhere (previously "Business network" /
  "Creator network").
- The discovery entry now matches the active role instead of showing both.

## 2. Top right holds four things only
Notifications · Messages · profile avatar · account menu.
The "Hire creators" button was removed from the header — page-level actions
belong on their page. "Edit profile" is not in the main nav; it lives on the
user's own profile.

## 3. Explicit role switcher
The account menu now names the active workspace in its own colour, and switching
is a deliberate two-option choice (Creator / Business). When only one profile
exists, the menu offers "Add a creator/business profile" instead.

## 4. Role safety — business users cannot land in creator setup
All entry points into setup now go through one function, `openOnboarding(role)`,
which states the role outright. The setup screen resolves its role in this order:

1. Editing an existing profile always follows the **active workspace**.
2. Otherwise, the role onboarding was explicitly opened with.
3. Otherwise, the `/join/:role` URL.
4. Active role.

A stale `/join/creator` URL left in the address bar can no longer decide which
setup form opens, which was the original cross-over bug.

## 5. Back button uses real history
Every in-app screen change pushes a browser history entry; a `popstate` listener
restores the matching screen. The in-app Back button, the browser Back button and
the mobile back gesture now agree.

## 6. Magenta / cyan identity system
Magenta `#E6007A` = creator. Cyan `#00D9FF` = business.
Nav highlight, account card and menu accents follow the active role. Business
onboarding was recoloured from magenta/purple to the cyan family
(`#00D9FF` → `#0E7C93`, ink `#036377`), with a subtle gradient progress bar,
a soft gradient review panel and deeper card shadow instead of flat white.

## Please test
- Creator onboarding end to end, then Business onboarding end to end.
- Switch roles, then open Account settings → Edit profile. A business user must
  land in business setup, a creator in creator setup, every time.
- Browser Back from a few screens deep, and after a `/join/...` deep link.
