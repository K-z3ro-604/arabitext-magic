# Four selectable book frames

## Build
- Replace the ornate-frame switch with a right-to-left frame selector offering: Simple Border, Classic Islamic, Royal Floral, and Minimalist Scientific.
- Create four distinct scalable SVG frame designs and keep each frame aligned to the full A4 page dimensions.
- Update the live preview immediately when the selection changes.
- Preserve the selected SVG frame in the cloned document used for PDF export.

## Verification
- Check all four choices visually in the A4 preview.
- Export a PDF and confirm its page size, frame coverage, and text layout.
- Confirm the project compiles without errors.

## Technical details
- Store the selected frame as a typed frame identifier rather than a boolean.
- Render the selected design through the existing book ornament component.
- Keep the established zero-margin A4 print rules and content-driven minimum height.
