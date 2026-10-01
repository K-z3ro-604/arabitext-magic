# Restore natural multi-page export flow

## Changes
- Remove the fixed-height and hidden-overflow wrapper from the A4 preview so long text can extend without being visually compressed or clipped.
- Change the printable A4 page from a fixed-height layout to a minimum-height layout with visible overflow, allowing browser printing to paginate naturally.
- Keep fixed A4 dimensions only on the temporary PDF pagination sheets, where each page is deliberately measured and split before capture.
- Preserve the selected frame, typography, margins, footnotes, and existing export controls.

## Verification
- Load the export page with long Arabic text and confirm the preview grows vertically.
- Emulate print and confirm A4 sizing, zero browser margins, and multi-page flow without clipped text.
- Confirm the app compiles without errors.

## Technical details
- Keep `@page { size: A4 portrait; margin: 0; }`.
- Use `min-height: 297mm` and `overflow: visible` for the live/print document.
- Retain bounded `297mm` temporary PDF sheets because the PDF generator requires explicit page boundaries after content is paginated.
