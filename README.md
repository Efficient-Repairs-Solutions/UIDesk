# UIDesk

Workspace z biblioteką komponentów React, Storybookiem i pustą aplikacją Next.js.

## Wymagania

Node.js >= 22.12 i pnpm 10.17.1 (np. przez Corepack).

```sh
pnpm install --frozen-lockfile
pnpm dev          # Next.js: http://localhost:3000
pnpm storybook    # Storybook: http://localhost:6006
pnpm build
pnpm typecheck
pnpm lint
```

`packages/ui` jest wewnętrznym pakietem workspace i eksportuje źródła TypeScript, a nie gotowy pakiet do publikacji. Aplikacje korzystające z niego muszą przetwarzać jego źródła i wskazać je w Tailwindzie przez `@source`. Tokeny są dostępne przez `@uidesk/ui/styles.css`. Storybooki komponentów znajdują się obok ich kodu.
