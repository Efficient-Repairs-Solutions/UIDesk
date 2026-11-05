# GitHub → Plane

Workflow synchronizuje wyłącznie status istniejących zadań Plane. Nie używa GitHub Issues. Konfiguracja znajduje się w `config.json`: workspace `repairdesk`, projekty `UD` i `RD`, nazwy stanów i końcowy branch `dev`. UUID projektów i statusów są sprawdzane i rozwiązywane przez API przy każdym uruchomieniu; stan musi mieć dokładnie jedną pasującą nazwę i grupę. Przed użyciem sprawdź, czy oba projekty mają podane nazwy i czy plan oraz konto Integrations pozwalają na odczyt projektu, stanów i zadania oraz zmianę zadania. Token musi być sekretem repozytorium `PLANE_API_KEY`.

Workflow musi być dostępny na domyślnej gałęzi `main`, także jego skrypt i konfiguracja. Po zmianie plików zadbaj o przegląd i ochronę `main`: `pull_request_target` wykonuje kod z tej gałęzi z dostępem do sekretu. PR-y z forków są pomijane. Nazwy branchy są odczytywane jako dane, nigdy nie są wykonywane. Zdarzenie tworzenia brancha działa po utworzeniu go w GitHubie, a nie lokalnie.

Obsługiwane są nazwy z jednym jednoznacznym identyfikatorem, np. `user/UD-3`, `feature/UD-3-opis`, `RD-123`. Inny otwarty gotowy PR dla zadania utrzymuje In Review; otwarty draft utrzymuje In Progress. Merge do `dev` ustawia Done, gdy nie ma innych otwartych powiązanych PR-ów; merge do innego brancha nie kończy zadania. Ręczne stany z grup completed i cancelled nie są zmieniane. Identyfikatory są rozpoznawane tylko w nazwach branchy źródłowych, nie w tytułach PR-ów.

**Ograniczenia:** PR-y muszą istnieć i mieć identyfikator w branchu, zanim pierwszy PR zostanie scalony: GitHub nie ujawnia przyszłych wymaganych PR-ów. Otwarte PR-y z forków są pomijane również przy sprawdzaniu pozostałych PR-ów; nie korzystaj z forków dla zadań automatyzowanych. Zamknięcie pośredniego PR-a przed utworzeniem kolejnego nie może być automatycznie rozpoznane jako stos. Stan końcowy jest chroniony także przed późniejszym ponownym otwarciem. Jeśli potrzebna jest ponowna praca, zmień stan ręcznie w Plane przed następnym zdarzeniem. Plane nie dokumentuje warunkowego PATCH, więc ponowny odczyt przed zapisem zmniejsza, lecz nie usuwa ryzyka wyścigu z ręczną zmianą. Kolejka Actions szereguje wyłącznie uruchomienia tego workflow w tym repozytorium; nie synchronizuje innych repozytoriów ani ręcznych zmian. Kolejka mieści maksymalnie 100 oczekujących uruchomień; kolejne zostaną anulowane. Przy błędzie sprawdź log i ponów zdarzenie lub uzgodnij stan ręcznie. API może zwrócić 402/403 z powodu planu lub uprawnień. Nie wklejaj tokenu do logów ani konfiguracji.

## Bezpieczne sprawdzenie

1. Zweryfikuj `config.json` i zabezpieczenia `main`, a następnie połącz workflow z `main` zgodnie z procesem repozytorium. Bez tego workflow nie reaguje na wskazane zdarzenia.
2. Utwórz w Plane osobne zadanie testowe, zapisz jego identyfikator i sprawdź początkowy stan. Nie używaj prawdziwego zadania produkcyjnego. Utwórz na GitHubie branch z tym identyfikatorem i sprawdź wynik uruchomienia oraz stan zadania w Plane.
3. Otwórz testowy PR do `dev` jako draft, oznacz go jako gotowy, wróć do draftu i sprawdź stan po każdym zakończonym uruchomieniu. Przetestuj również drugi otwarty gotowy PR i zamknięcie pierwszego bez merge.
4. Do testu Done użyj PR-a z nieszkodliwą zmianą zaakceptowaną przez zespół; scal go do `dev` po zamknięciu pozostałych powiązanych PR-ów. Sprawdź stan Done w Plane i logi Actions. Przetestuj też ręcznie ustawiony Cancelled: kolejne zdarzenie nie powinno go zmienić.
5. Usuń testowe branche i uporządkuj testowe zadanie zgodnie z waszym procesem. W razie 402/403 lub błędu stanu nie obchodź ograniczeń; sprawdź plan, członkostwo, uprawnienia tokenu i konfigurację stanów.

Lokalne testy: `node --test .github/plane/*.test.mjs`. Nie korzystają z sieci ani z sekretów.
