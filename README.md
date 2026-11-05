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

## Tokeny DeskUI

Tokeny z pliku Figma DeskUI znajdują się w `packages/ui/src/styles/`, podzielone na kolory, wymiary, typografię i cienie. Plik `tokens.css` łączy je we wspólny punkt wejścia. Domyślny jest motyw jasny; ciemny można włączyć przez `data-theme="dark"` na elemencie dokumentu lub kontenerze. Font Manrope jest dostarczany lokalnie z pakietem.

- Kolory: zmienne `--dui-*` i klasy Tailwind, np. `bg-dui-brand-primary`, `text-dui-basic-foreground`.
- Odstępy i promienie: np. `p-dui-16`, `rounded-dui-8`; pozostałe wymiary i grubości obrysu są dostępne jako zmienne CSS, np. `--dui-control-height-standard` i `--dui-stroke-sm`.
- Typografia: klasy `dui-display-large`, `dui-heading-medium`, `dui-body-small` itd. zawierają rodzinę i wagę fontu, wielkość oraz wysokość linii z Figmy.
- Cienie: klasy takie jak `shadow-dui-subtle-1` i `shadow-dui-floating-3`; ich kolory zmieniają się razem z motywem. Promień rozmycia cienia Figmy jest przeliczany na CSS współczynnikiem 0,85.

## Testowanie komponentów

Po instalacji zależności zainstaluj Chromium dla Playwrighta:

```sh
pnpm --filter @uidesk/storybook exec playwright install chromium
pnpm test                           # stories, interakcje i automatyczna kontrola a11y
pnpm --filter @uidesk/storybook test:watch
pnpm test:visual                    # porównanie ze wzorcami Linux
```

Testy wizualne porównują obrazy generowane w kontenerze `mcr.microsoft.com/playwright:v1.64.1-noble` na Linux x86-64. Na innym systemie renderowanie może się różnić. Aby zaktualizować wzorce w tym samym środowisku co CI, wykonaj poniższe polecenie z katalogu repozytorium (wymaga Dockera; instalacja w kontenerze zapisuje `node_modules` w zamontowanym katalogu):

```sh
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.64.1-noble bash -c 'npm install -g pnpm@10.17.1 && pnpm install --frozen-lockfile && pnpm --filter @uidesk/storybook test:visual:update'
```

Po aktualizacji przejrzyj zmiany obrazów i dołącz uzasadnione wzorce do PR-a. Każdy nowy komponent powinien mieć stories przedstawiające jego warianty i stany, testy istotnych interakcji oraz automatyczną kontrolę a11y. Dla zmian wyglądu dodaj reprezentatywne ujęcia; obsługę klawiatury i focus sprawdzaj również ręcznie.
