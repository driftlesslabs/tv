(() => {
  "use strict";

  const dottedIdentifierPattern = /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/;

  document.querySelectorAll(".sy-lside .globaltoc a").forEach((link) => {
    const label = link.textContent.trim();
    if (!dottedIdentifierPattern.test(label)) {
      return;
    }

    const fragment = document.createDocumentFragment();
    label.split(".").forEach((segment, index) => {
      if (index > 0) {
        fragment.append(document.createTextNode("."));
        fragment.append(document.createElement("wbr"));
      }
      fragment.append(document.createTextNode(segment));
    });
    link.replaceChildren(fragment);
  });
})();
