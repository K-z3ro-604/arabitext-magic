# Verify and correct multi-page framed PDF exports

## Build
- Stress-test PDF downloads with long Arabic content for all four frame styles.
- Inspect every rendered PDF page for A4 dimensions, frame coverage, clipping, and text scaling.
- If the current continuous-page capture splits or stretches frames, paginate the export into true A4 sheets while keeping text and footnotes inside safe frame margins.
- Preserve the selected frame consistently on every exported page without changing the existing live selector.

## Verification
- Download one long multi-page PDF for each frame style.
- Render all pages to images and visually inspect first, middle, and final pages.
- Confirm each page is A4, text remains legible and uncompressed, and frame strokes are fully visible.
- Confirm the project compiles without errors.

## Technical details
- Keep zero browser/PDF margins and the established 210 × 297 mm page format.
- Avoid scaling a tall document into one page-sized frame; paginate content before capture when necessary.
- Reuse the existing frame component so preview and PDF artwork remain identical.
