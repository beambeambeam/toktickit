import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { HomePage } from "@/routes/index";

it("renders the home heading", () => {
  const markup = renderToStaticMarkup(createElement(HomePage));

  expect(markup).toContain("<h1>Welcome Home!</h1>");
});
