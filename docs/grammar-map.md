# Карта грамматики A1–B1

Что вообще бывает в немецком на этих уровнях и что из этого тренируется. Нужна, чтобы
следующее правило выбирали не на глаз, а по дырке в карте.

Колонка «правило» — id из `content/manual/explain.yaml`; пусто значит, что правила нет.
Сколько сейчас правил и заданий — последняя строка `tools/check_data.py`.

## Как это устроено в приложении
**Направление = правило**, и оно же единица повтора: карточка FSRS заводится на правило,
слово — второе измерение. На главной правила собраны в группы (`group` в `explain.yaml`,
список закрытый): **падеж**, **артикль**, **существительное**, **прилагательное**, **глагол**.
Это и есть «что тренируем», и оно видно на экране, а не только в данных.

Порядок внутри группы — порядок написания шаблонов, а не порядок обучения: настоящий
требует графа предпосылок, которого ещё нет (`TODO.md`).

## Существительное
| направление | правило | состояние |
|---|---|---|
| род: der / die / das | `genus` | три кнопки; бейдж рода у слова в этом задании прячется |
| множественное число | `plural-form` | |
| n-склонение (der Nachbar → den Nachbarn) | `n-deklination` | Akkusativ и Dativ |
| сложные слова: род по последнему корню | — | не выражается пропуском |

## Падеж
| направление | правило | состояние |
|---|---|---|
| Nominativ: подлежащее | `nominativ-subjekt` | |
| Akkusativ: прямой объект | `akkusativ-objekt` | |
| Dativ: глаголы с Dativ | `dativ-objekt` | только helfen и antworten в рамке |
| Genitiv: принадлежность | `genitiv-besitz` | |
| предлоги + Dativ | `prep-dativ` | |
| предлоги + Akkusativ | `prep-akkusativ` | |
| Wechselpräposition: wo? → Dativ | `wechsel-wo` | |
| Wechselpräposition: wohin? → Akkusativ | `wechsel-wohin` | |
| предлоги + Genitiv (wegen, während) | `prep-genitiv` | |

## Артикль и его родня
| направление | правило | состояние |
|---|---|---|
| ein / eine | `nominativ-subjekt`, `akkusativ-objekt` | неопределённый идёт внутри падежей |
| kein | `negation-kein` | |
| mein, dein — Nominativ | `possessiv-nominativ` | |
| mein — Akkusativ | `possessiv-akkusativ` | |
| mein — Dativ | `possessiv-dativ` | |
| слияния: im, ins, zum | `merge-prep-article` | |
| личные местоимения в Akkusativ | `pronomen-akkusativ` | |
| личные местоимения в Dativ | `pronomen-dativ` | |
| man | `man-subjekt` | пропуск — форма глагола: четыре местоимения в рамке все верны |

## Прилагательное
| направление | правило | состояние |
|---|---|---|
| после ist (без окончания) | `adj-praedikativ` | |
| слабое склонение, Nominativ | `adj-nom-e` | |
| слабое склонение, Akkusativ | `adj-akk-en` | |
| слабое склонение, Dativ | `adj-dat-en` | |
| без артикля (сильное) | `adj-ohne-artikel` | |
| во множественном | `adj-plural` | |
| степени сравнения | `komparativ` | комператив и суперлатив в одном правиле |
| смешанное после ein (Nominativ и Akkusativ) | `adj-gemischt` | Dativ и Genitiv пока внутри других правил |

## Глагол
| направление | правило | состояние |
|---|---|---|
| Präsens: er / sie / es | `praesens-3sg` | |
| Präsens: du | `praesens-2sg` | |
| отделяемая приставка | `praesens-trennbar` | |
| Perfekt: haben или sein | `perfekt-aux` | |
| Partizip II | `perfekt-partizip` | |
| Präteritum | `praeteritum` | |
| модальные глаголы | `modalverben` | |
| предлог при глаголе | `verb-praeposition` | |
| два предлога у глагола | `verb-praeposition-zwei` | |
| возвратные глаголы (sich) | `reflexiv` | пять глаголов, два лица |
| Imperativ | `imperativ` | ⚠ глаголы на -eln/-ern не берутся: форм три, и все верные |
| Futur I (werden + Infinitiv) | `futur` | |
| Konjunktiv II (würde, könnte) | `konjunktiv2` | würde + инфинитив; hätte и wäre только в тексте правила |
| Passiv (wird + Partizip II) | `passiv` | |

## Синтаксис
| направление | правило | состояние |
|---|---|---|
| nicht против kein | `negation-nicht-kein` | выбор держится на артикле, не на смысле |
| глагол вторым в главном | — | не выражается одним пропуском |
| глагол в конец в придаточном (weil, dass) | — | пропуск в конце тренирует форму, позицию показывает рамка |
| вопрос: W-Frage и Ja/Nein | — | рамки с `wo?`/`wohin?` есть внутри падежей |
| es gibt | `es-gibt` | смысл говорит «есть», а падеж нужен Akkusativ |

## Что осталось
Ни одного направления без правила на A1–B1 не осталось. Неполными остаются два:
- **Konjunktiv II** — сделано würde + инфинитив; hätte, wäre и könnte живут только
  в тексте правила;
- **Императив** не берёт глаголы на -eln и -ern: форм три, и все приняты
  (bastel, bastele, bastle). Нужен ввод с несколькими верными ответами.

## Чего в формате не будет
Формат — **одна фраза с одним пропуском**, и это решено (`docs/spec.md`). Поэтому сюда
не поместятся: свободный порядок слов, сборка предложения из плиток, перевод ru → de.
Для них нужен синтаксический разбор предложений, которого у проекта нет.
