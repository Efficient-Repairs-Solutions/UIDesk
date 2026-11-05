import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Button", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: ["primary", "outline"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Button",
    });
    await expect(button).toHaveAttribute("type", "button");
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter} ");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(3);
  },
};
export const Outline: Story = {
  args: { variant: "outline", type: "submit" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Button" }),
    ).toHaveAttribute("type", "submit");
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Button",
    });
    await expect(button).toBeDisabled();
    button.focus();
    await userEvent.keyboard("{Enter} ");
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const VisualMatrix: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gap: 16,
        padding: 24,
        background: "var(--dui-basic-background)",
      }}
    >
      {(["primary", "outline"] as const).map((variant) => (
        <div
          key={variant}
          style={{ display: "flex", alignItems: "center", gap: 16 }}
        >
          {(["sm", "md", "lg"] as const).map((size) => (
            <Button key={size} variant={variant} size={size}>
              {variant} {size}
            </Button>
          ))}
          <Button variant={variant} disabled>
            Disabled
          </Button>
        </div>
      ))}
    </div>
  ),
};
