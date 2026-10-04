# Three student note-taking templates

## Build
- Add three new selectable designs alongside the four existing book frames: a ruled study header, a structured lecture header, and a minimal annotation header.
- Keep every new decoration confined to a shallow band at the top of each A4 page; leave both side margins and the entire lower page free of borders and ornament.
- Repeat the chosen top header on every generated page while preserving the current Arabic title, chapter, body, footnotes, and page numbering.
- Keep the existing fixed A4 pagination so long text breaks into distinct pages without clipping.
- Translate each top-only design into a matching Word header treatment without adding side or bottom page borders.

## Verification
- Preview all three designs and confirm decoration never extends into the side or lower writing area.
- Test long Arabic text to confirm multiple A4 pages are created with the selected header repeated cleanly.
- Trigger native print/PDF and generate Word output, checking page dimensions, breaks, text flow, and clear note-taking space.
- Confirm the project compiles without errors.

## Technical details
- Extend the typed template identifier used by the current selector.
- Render top-only SVG artwork through the shared page ornament component so preview and print remain identical.
- For Word, use section headers and top-only paragraph borders rather than page borders for these three styles.
