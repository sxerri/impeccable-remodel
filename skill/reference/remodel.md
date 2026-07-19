# Remodel Flow

Modernize an existing HTML implementation **in place**: new visual system, same document. The existing markup is the canonical document: its structure, semantics, content, and integration hooks are preserved by default, and the design system is delivered as a rebuilt style layer rather than markup regeneration.

Remodel is a mode of `craft`, entered when craft Step 0 detects that the target is an existing HTML/template page and the intent is to restyle it. Once this file is loaded, it owns the rest of the flow. The craft steps apply only where this file says so.

**Target behavior:** given existing HTML + a design objective, produce a stylistic redesign implementation while preserving existing functionality, structure, and integrations. The output must preserve a clean, minimal, reviewable markup diff (easy to migrate, easy to reconcile against server-rendered templates) with a style layer owned end to end by the rebuild.

## Context rules

- **Stardust projects:** the direction contract already exists. Treat `DESIGN.md`, `DESIGN.json`, `stardust/direction.md`, and canon (when present) as the confirmed design direction and `PRODUCT.md` as project context. Do not re-run discovery; do not divert into `init`.
- **Non-stardust projects:** follow the normal setup preconditions (craft diverts to `init` when PRODUCT.md is missing). If no DESIGN.md exists, suggest `$impeccable document` to derive one from the codebase; the source page itself is the visual baseline until one exists.
- The user's design objective for this task (restyle brief, anchor references, color strategy) is the task-specific contract, layered on top of project context.

## Step R0: Direction check (compact)

Remodel needs a confirmed visual direction before the preflight plan, but never a full discovery interview. If the direction contract (stardust spec, or a user brief that already names color strategy / theme / anchors) is complete, state it in one line and proceed. If it is missing a piece, run a **compact shape** only: 3–5 bullets naming the visual lane, ending with one specific question or "confirm or override". One round, no full 10-section brief; content, audience, and information architecture are already fixed by the source document. On harnesses with native image generation, a confirmed compact direction satisfies craft's Step 3: mocks are optional, and a supplied direction spec or DESIGN.md replaces them.

## Step R1: Preflight edit plan (mandatory, before any edit)

Do not write or modify a single line until this plan exists and has been shown to the user (or, in non-interactive operation with an already-confirmed direction, recorded in the conversation).

1. **Read the entire source document.** All of it, including `<head>`, inline scripts, and template syntax. Partial reads produce partial plans.
2. **Classify every region** into exactly one of three sets:
   - **Immutable**: anything with integration or identity weight:
     - elements bearing `id`, `data-*`, `aria-*`, `role`, `name`, `for`, or event-handler attributes (`onclick`, `@click`, `x-on:*`, `hx-*`, `ng-*`, `v-on:*`, etc.)
     - `<form>` elements, their controls, and their action/method wiring
     - `<script>` tags and inline handlers; analytics/Tag Manager attributes and snippets (`data-ga`, `gtag`, `dataLayer`, `data-analytics`, `data-track`, etc.)
     - CMS placeholders, template directives, and server-render markers (`{{ … }}`, `{% … %}`, `<?php … ?>`, `<%= … %>`, web components, custom elements)
     - landmark and heading structure (`header`, `nav`, `main`, `footer`, `article`, `section`, `aside`, `h1`–`h6`) as a *sequence*
   - **Visual-only** covers everything else: unclassed or purely presentational wrappers, decorative containers, spacing/type/color carriers with no hooks.
   - **Style layer (strip, never preserved):** `<style>` elements and stylesheet `<link>` tags are not markup for preservation purposes. They are the old generated artifact; R3 step 1 removes all of them. Class-bearing elements stay (classes are markup); only the style-bearing constructs are stripped.
3. **Emit the plan** as a compact checklist: region → classification → intended edit. Name every wrapper element you expect to add and why a layout primitive requires it. Name any semantic change you believe is required, with justification (see R2).
4. **State the expected churn**: roughly how much of the document you intend to touch. If the honest answer is "most of the DOM", the approach is wrong; go back to classes-and-CSS.

## Step R2: Hard invariants

These are match-and-refuse rules, same standing as impeccable's absolute bans. If an edit you're about to make violates one, find a different edit.

- **Preserve DOM hierarchy.** Do not reparent, reorder, flatten, or re-nest existing elements unless a structural change is explicitly required by the brief.
- **Preserve every hook.** All `id`, `data-*`, `aria-*`, `role`, `name`, `for`, and event-handler attributes survive unchanged. Attribute *values* for hooks are never "improved".
- **Preserve semantics.** Do not change the tag name of a semantic element, and do not remove any existing semantic element. `<table>` stays a table, `<ul>` stays a list, `<h2>` stays an h2.
- **Do not rewrite content.** Text, links, images, and embeds stay as authored unless the user explicitly asked for content changes. This includes alt text and `href`/`src` values.
- **Preserve forms completely.** Names, actions, methods, field order, validation attributes, and associated labels.
- **Preserve templates.** Server-render markers and template directives are moved only with their parent element, never rewritten, re-encoded, or "cleaned up".
- **Minimize DOM churn.** The diff is the deliverable's quality metric. A reviewer should be able to verify hook preservation by scanning it.
- **No source CSS survives.** The output contains zero of the source document's `<style>` blocks and zero of its stylesheet `<link>` tags. Surviving source CSS is a failure on par with a removed hook. One carve-out: the rebuilt layer may re-declare font or icon stylesheet links the direction requires; those are new references, not preserved ones.

**The single allowed exception path:** a structural change is permitted only when (a) it was named in the preflight plan with justification, and (b) the justification cites a concrete requirement: accessibility repair, a layout primitive that cannot be achieved otherwise, or an explicit user instruction. "Cleaner markup" is never a justification.

## Surface contract: evolved surface (conditional)

Applies when the direction stamps `surfaceFidelity: "evolved"` (stardust: `DESIGN.json.extensions.surfaceFidelity`). In this mode the goal is to modernize within the site's existing design language, not to introduce a new one. These rules carry the same match-and-refuse standing as R2.

- **Anchors come from the source.** Design anchors (hue families, type families, component vocabulary) are read from the extracted current design system (`stardust/current/DESIGN.md`, `_brand-extraction.json`, the document's computed styles at capture time, and original page screenshots when available under `stardust/current/assets/screenshots/`) plus the direction's modernization brief. Do not invent anchors.
- **Every visual decision traces.** Each color, type, spacing, and component choice must cite either a source-system token or a specific brief item (type scale normalization, contrast repair, spacing rhythm, token hygiene, component consistency).
- **New design language is a violation.** Introducing a hue family, type family, or component vocabulary absent from both the source system and the brief fails the same way a structural violation does: find a different edit.
- **Modernization, not replacement.** The reviewer test: before/after screenshots should read as the same site's design, modernized. If the output reads as a different site wearing the same content, the surface contract failed regardless of structural cleanliness.

## Step R3: Rebuild the style layer (the allowed edit surface)

The markup is the immutable artifact; the stylesheet is the generated artifact. All visual change is delivered by rebuilding the style layer from the ground up for the preserved document, never by overlaying new CSS on the source's own styles. Overlaying produces two-cascade warfare: specificity fights, half-migrated components, unreviewable output.

1. **Strip the source style layer.** Remove the document's own `<style>` blocks and stylesheet `<link>` tags from the working copy. When the handoff already stripped them (stardust prototype flow strips at copy time), verify zero remnants instead. Inline `style=` attributes stay: they may carry JS-managed state, and runtime code re-owns them. Record every stripped block and link in the preflight plan (R1) before removing anything.
2. **Inventory the selectors.** Read the preserved DOM and enumerate what needs styling: every landmark, component, and class in the captured markup. The rebuilt stylesheet must cover the full inventory. Elements previously styled only by external stylesheets are the known naked-region risk; name them in the plan.
3. **Author one coherent stylesheet.** A single style layer (one `<style>` block or one linked file), built on CSS custom properties, written fresh for this document. Never edit the source's old rules, never import them. Follow the General rules and the loaded register reference exactly as in a from-scratch build; the design bar does not drop because the DOM is preserved. The rebuild owns every breakpoint and state the page ships.
4. **Class attributes.** Add classes to existing elements only where the rebuilt stylesheet needs a selector it cannot get from structure alone. Additive by default; never remove classes that carry hooks or template logic.
5. **Wrapper elements.** A new `<div>`/`<span>` wrapper is allowed only where a layout primitive (grid track, flex cluster, aspect box, container-query context) genuinely requires it. Each wrapper was justified in the preflight plan. Wrappers never carry content, hooks, or semantics of their own.

**Edit incrementally.** Make a series of small, reviewable edits to the existing markup. Do not regenerate the document markup, rewrite it wholesale, or "round-trip" it through your own formatting. The style layer is the one exception: it is rebuilt wholesale by design. Match the source file's existing formatting conventions (indentation, quoting, attribute order) so the markup diff stays semantic.

**Respect the pipeline.** If the page is server-rendered or built (Rails, Next, Astro, AEM, static generators), edit the *source template*, not the rendered output, and run the project's own build/dev verification. The production bar from craft Step 4 applies in full (real states, responsive behavior, contrast, motion rules); it is simply delivered through the allowed edit surface.

## Step R4: Verify

- **Invariant self-check (every pass, not just the last):** re-read the modified document against the source and enumerate: hooks removed or altered (expected: none), semantic tags changed or removed (expected: none), content changed (expected: none, unless requested), wrappers added (expected: exactly those in the plan), source style blocks surviving (expected: 0), source stylesheet links surviving (expected: 0). Report the count of each. If any expectation fails, fix before continuing; do not present a violation as a choice.
- **Churn metric:** state the markup diff size relative to the document (lines changed / total lines). There is no fixed threshold, but a remodel that rewrites most markup lines has failed its purpose. The style layer is exempt from churn accounting: it is a rebuild by design, and its quality metric is selector-inventory coverage and coherence, not diff size.
- **Surface traceability (evolved mode only):** list which source-system tokens and which brief items were applied. Any color, type, spacing, or component choice that traces to neither is a violation; fix before continuing.
- **Same-site test (visual iteration anchor):** when original screenshots or the live URL are available (stardust: `stardust/current/assets/screenshots/`), iterate against them side by side. Under the evolved surface contract the output must read as the same site's design, modernized; under a reimagined direction it must read as the direction applied to the same document.
- **Visual iteration** proceeds exactly as craft Step 5: screenshot at multiple viewports, critique against the direction contract and impeccable's DON'Ts, patch, re-inspect. Every iteration re-runs the invariant self-check above.
- Run the project's own checks when they exist (build, gates, detector). Detector findings are defect evidence only.

## Step R5: Present

- Show the before/after (screenshots or side-by-side).
- Summarize the edit surface actually used: classes added, CSS written, wrappers added (with their justifications), structural changes (expected: none or the justified few).
- State the churn metric and the invariant self-check results explicitly.
- Note anything in the source that limited the design and would need a structural decision from the user to unlock.
