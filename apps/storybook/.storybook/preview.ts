import "./preview.css";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: { controls: { expanded: true }, a11y: { test: "error" } },
  tags: ["autodocs"],
};
export default preview;
