# Sunburst Pop implementation notes

## Visual system
- **Theme:** Sunburst Pop, a comic-book sticker look using warm cream `#FFF6E5`, ink `#1B1530`, orange `#FF6A1F`, pink `#FF3D8B`, lime `#B6F01F`, sky `#2EC5FF`, and yellow `#FFD23F`.
- **Alternate theme:** Midnight Pop, selectable from the home-page navigation. The choice is stored locally on the current device.
- **Components:** thick ink borders, offset hard shadows, halftone dots, sticker cards, chunky rounded buttons, comic-burst result moments, and thumb-friendly responsive navigation.
- **Motion:** short squash/bounce feedback, with system `prefers-reduced-motion` respected and a user-toggleable reduced-motion setting.
- **Sound:** optional synthesized local foley using Web Audio after user interaction. No microphone or webcam is used by these additions.
- **Typography:** system rounded sans-serif fallbacks; no external font download is required.

## Implemented in this first stage
- Existing game, rooms, Quick Play, computer difficulty, accounts, friends, leaderboard and Custom Arena Lab markup/logic preserved.
- Home-page sticker navigation linking to Collection/Achievements, Custom Arena Lab and Upgrade page.
- Eight selectable local mascot companions with catchphrases, saved locally.
- Sunburst Pop / Midnight Pop theme toggle.
- Sound on/off and reduced-motion controls.
- Local Quick Draw reaction test, local coin flip and rotating hand-game facts.
- Mascot reactions, optional synthesized foley, and comic POW! burst when a win result is detected.
- Upgrade page restyled to Sunburst Pop, with monthly/yearly controls retained, a comparison table, and roadmap previews clearly marked as previews.
- Service worker shell updated to cache the new enhancement script and use a new cache version.

## Roadmap not yet built
The complete 200-feature brief is a roadmap, not a single safe patch. Story chapters/cutscenes, multiplayer variants that require protocol/server changes, tournaments at larger scale, webcam gesture mode, voice chat, moderation pipelines, marketplace, 3D/shader scenes, upload tools, cloud sync, parental controls, and the full Battle Pass/seasonal live operations still need separate design, server-side entitlement enforcement, privacy review and testing. They must not be represented as live simply because a plan lists them.
