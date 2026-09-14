# Comal++ visual redesign

Implemented on `copilot/comal-interactive-mockup`.

## Scope and design

The existing ready-order workflow is unchanged: manual codes 01–99, optional counters, explicit recall, delivery, and confirmed removal. No preparation state, invented metrics, extra routes, or backend features were added. API, database, synchronization, announcement scheduling, audio playback, and YouTube integration remain as implemented before this redesign.

- Public display: original coffee photograph, floating navy glass queue, five visible tickets per page, large announcement, persistent latest-ticket highlight, and readable media/connection notices. The announcement uses a brief scale/fade and restrained blue border; reduced-motion preferences disable animation.
- Cashier: compact navigation, clear page heading, prominent ticket entry, a wider ready-order list, quieter recall controls, and supporting media controls. Narrow screens use a navigation rail or horizontal navigation. Changing navigation sections resets the visual scroll position.
- Media: segmented source controls, original CSS playlist artwork, a playback strip, and a more legible local library.
- Settings and dialogs: consistent dark fields, labeled dialogs, restrained confirmation states, and clear action hierarchy.

Shared CSS variables and Tailwind theme tokens are in `src/styles/base.css`. The existing components were reused; `StatusBadge` is the only new shared React component. `secondary` is the button class; avoid `outline`, which conflicts with Tailwind's outline utility. Fonts, icons, image, and announcement audio are bundled locally.

## Validation

- Production build, TypeScript checks, and all five existing backend regression tests passed.
- Browser checks used a separate database in `test-results/redesign/preview.sqlite`; the working cafe database was not changed.
- Verified registration, duplicate rejection, both counters and no counter, counter reassignment, recall, delivery, removal confirmation, code reuse, manual pagination, and automatic-view toggle.
- Verified settings save, local playlist selection, audio activation, pause/resume, mute, and return to the welcome image.
- Verified a local-service interruption: cached tickets stay visible, warning messages appear, and registration is disabled. Restarting restores saved tickets and enables registration without replaying old announcements.
- Compared the ten existing action handlers against the original branch version; their implementations are unchanged. Routing, API, announcement, and synchronization modules are also unchanged.
- Public display checked at 1280×720, 1920×1080, 3840×2160, and 1024×768. Cashier checked at desktop, 1024×768, 768×1024, and 390×844. Inspected empty and populated states and dialogs.
- YouTube configuration and its timeout fallback were verified. Actual YouTube video playback could not be verified because the embed did not respond in the test environment.

## Original welcome image

File: `public/assets/coffee-welcome.png`.

Created using the built-in image generation tool, without reference images. The image is bundled with the application and does not require a network request to an external image service.

Prompt:

> Use case: photorealistic-natural. Asset type: locally bundled welcome background for a premium Mexican university coffee shop queue display. Create a beautiful editorial photograph, wide landscape 16:9 composition. A warm ivory ceramic cup of cappuccino with delicate rosetta latte art on a dark walnut cafe counter, cup placed in the right-center at about 72% across and 60% down. Soft natural side light picks out the cup, subtle steam, tactile ceramic and wood grain. Deep out of focus navy charcoal cafe background with a few very restrained warm highlights, left third predominantly dark unobtrusive negative space for a queue panel. Restrained warm neutral palette, sophisticated authentic specialty coffee editorial, cinematic but natural exposure, no artificial blue light. Crop fairly close so coffee reads well on a large television, keep full cup and saucer visible. No people, text, logos, watermarks, UI, frames or graphic overlays. Photographic realism and quiet hospitality.
