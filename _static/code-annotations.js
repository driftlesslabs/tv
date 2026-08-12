(() => {
  "use strict";

  const markerPattern = /\((\d+)\)!?/g;
  const commentSelector = ".c, .c1, .cm, .cp, .cs";
  const commentOnlyPrefix = /^\s*(?:#|\/\/|--|\/\*|\*)\s*$/;

  /** Close an annotation popover and restore its trigger state. */
  function closePopover(group, { restoreFocus = false } = {}) {
    const openPopover = group.querySelector(
      ".code-annotation-popover:not([hidden])",
    );
    if (!openPopover) {
      return;
    }

    openPopover.hidden = true;
    openPopover.classList.remove("is-above");
    openPopover.style.removeProperty("left");
    openPopover.style.removeProperty("top");

    const activeTrigger = group.querySelector(
      '.code-annotation-marker[aria-expanded="true"]',
    );
    if (activeTrigger) {
      activeTrigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) {
        activeTrigger.focus();
      }
    }
  }

  /** Position a visible popover beside its marker without leaving the viewport. */
  function positionPopover(group, trigger, popover) {
    const gap = 10;
    const edge = 8;
    const groupRect = group.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    popover.style.visibility = "hidden";
    popover.hidden = false;

    const popoverRect = popover.getBoundingClientRect();
    const maxLeft = Math.max(edge, groupRect.width - popoverRect.width - edge);
    const centeredLeft =
      triggerRect.left -
      groupRect.left +
      (triggerRect.width - popoverRect.width) / 2;
    const left = Math.min(Math.max(centeredLeft, edge), maxLeft);

    let top = triggerRect.bottom - groupRect.top + gap;
    const fitsBelow = triggerRect.bottom + gap + popoverRect.height <= innerHeight;
    const fitsAbove = triggerRect.top - gap - popoverRect.height >= 0;
    if (!fitsBelow && fitsAbove) {
      top = triggerRect.top - groupRect.top - popoverRect.height - gap;
      popover.classList.add("is-above");
    } else {
      popover.classList.remove("is-above");
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.removeProperty("visibility");
  }

  /** Open the annotation connected to a marker, closing any prior annotation. */
  function openPopover(group, trigger, popover) {
    const wasOpen = !popover.hidden;
    closePopover(group);
    if (wasOpen) {
      return;
    }

    trigger.setAttribute("aria-expanded", "true");
    positionPopover(group, trigger, popover);
  }

  /** Build an accessible marker button for one numbered annotation. */
  function createMarker(number, popover, group) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "code-annotation-marker";
    marker.innerHTML = `
      <svg
        class="code-annotation-marker-icon"
        data-icon="ic:baseline-add-circle"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z"
        />
      </svg>
    `;
    marker.dataset.annotationNumber = number;
    marker.setAttribute("aria-controls", popover.id);
    marker.setAttribute("aria-expanded", "false");
    marker.setAttribute("aria-label", `Show code annotation ${number}`);
    marker.addEventListener("click", () =>
      openPopover(group, marker, popover),
    );
    return marker;
  }

  /** Replace marker text inside a Pygments comment span with buttons. */
  function enhanceCommentSpan(span, popovers, group) {
    const text = span.textContent;
    const matches = [...text.matchAll(markerPattern)];
    if (!matches.length) {
      return;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    matches.forEach((match) => {
      const number = Number.parseInt(match[1], 10);
      const popover = popovers[number - 1];
      const markerStart = match.index;
      const markerEnd = markerStart + match[0].length;
      if (!popover) {
        fragment.append(document.createTextNode(text.slice(cursor, markerEnd)));
        cursor = markerEnd;
        return;
      }

      let prefix = text.slice(cursor, markerStart);
      if (cursor === 0 && commentOnlyPrefix.test(prefix)) {
        prefix = "";
      }
      fragment.append(document.createTextNode(prefix));
      fragment.append(
        createMarker(String(number), popover, group),
      );
      cursor = markerEnd;
    });
    fragment.append(document.createTextNode(text.slice(cursor)));
    span.replaceChildren(fragment);
  }

  /** Enhance one marked code block and its immediately following ordered list. */
  function enhanceCodeBlock(codeBlock, groupIndex) {
    const annotationList = codeBlock.nextElementSibling;
    if (!annotationList || annotationList.tagName !== "OL") {
      return null;
    }

    const popovers = [...annotationList.children].filter(
      (child) => child.tagName === "LI",
    );
    if (!popovers.length) {
      return null;
    }

    const group = document.createElement("div");
    group.className = "code-annotation-group";
    codeBlock.before(group);
    group.append(codeBlock, annotationList);

    annotationList.classList.add("code-annotation-list");
    annotationList.setAttribute("aria-label", "Code annotations");
    popovers.forEach((popover, index) => {
      const number = index + 1;
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "code-annotation-close";
      closeButton.setAttribute("aria-label", "Close code annotation");
      closeButton.addEventListener("click", () =>
        closePopover(group, { restoreFocus: true }),
      );

      popover.id = `code-annotation-popover-${groupIndex}-${number}`;
      popover.classList.add("code-annotation-popover");
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", "Code annotation");
      popover.prepend(closeButton);
      popover.hidden = true;
    });

    codeBlock
      .querySelectorAll(commentSelector)
      .forEach((span) => enhanceCommentSpan(span, popovers, group));

    // Do not hide the explanatory list unless at least one marker was enhanced.
    if (!group.querySelector(".code-annotation-marker")) {
      group.replaceWith(codeBlock, annotationList);
      popovers.forEach((popover) => {
        popover.hidden = false;
        popover.classList.remove("code-annotation-popover");
        popover.querySelector(".code-annotation-close")?.remove();
        popover.removeAttribute("id");
        popover.removeAttribute("role");
        popover.removeAttribute("aria-label");
      });
      annotationList.classList.remove("code-annotation-list");
      annotationList.removeAttribute("aria-label");
      return null;
    }

    group.classList.add("is-enhanced");
    codeBlock.querySelector("pre")?.addEventListener("scroll", () =>
      closePopover(group),
    );
    return group;
  }

  const groups = [...document.querySelectorAll(".code-annotated")]
    .map(enhanceCodeBlock)
    .filter(Boolean);

  if (!groups.length) {
    return;
  }

  document.addEventListener("click", (event) => {
    groups.forEach((group) => {
      if (!group.contains(event.target)) {
        closePopover(group);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      groups.forEach((group) => closePopover(group, { restoreFocus: true }));
    }
  });

  addEventListener("resize", () => {
    groups.forEach((group) => closePopover(group));
  });
})();
