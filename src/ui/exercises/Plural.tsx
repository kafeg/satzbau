// Данные упражнения «Множественное число» для общих частей экрана (docs/ex-plural.md). Варианты — типы формы,
// не слова: неправильные формы на экран не выводятся никогда.
import { LABEL, type Parse, type Pl, parse, right, typeLabel, typesFor } from '../../core/exercises/plural.ts'
import type { Noun } from '../../core/types.ts'
import { Art } from '../answer/Art.tsx'
import type { View } from './index.ts'


// тип на кнопке: знак умлаута крупнее и цветом — мелкие две точки над чёрточкой читались как прочерк
function Type({ p }: { p: Pl }) {
  const t = typeLabel(p)
  return t.startsWith('¨') ? (
    <>
      <span className="uml">¨</span>
      {t.slice(1)}
    </>
  ) : (
    <>{t}</>
  )
}

// форма, по которой показываем разбор: та, что совпала с ответом, иначе первая
function shown(w: Noun, a: Pl | null): [string, Parse] {
  const forms = w.plural.map((f) => [f, parse(w.lemma, f)] as const).filter((x): x is [string, Parse] => x[1] !== null)
  const hit = a && forms.find(([, p]) => p.end === a.end && p.uml === a.uml)
  return hit ?? forms[0]!
}

// форма с выделенными изменёнными буквами: умлаут и окончание
function Form({ form, p }: { form: string; p: Parse }) {
  const cut = form.length - p.tail
  return (
    <span className="mono">
      {[...form.slice(0, cut)].map((ch, i) => (i === p.at ? <b key={i}>{ch}</b> : ch))}
      {p.tail > 0 && <b>{form.slice(cut)}</b>}
    </span>
  )
}

// как образована форма: «без окончания, форма не меняется», «окончание -e и умлаут u → ü»
function how(lemma: string, p: Parse): string {
  const uml = p.uml ? `умлаут ${lemma[p.at]} → ${'äöüÄÖÜ'['aouAOU'.indexOf(lemma[p.at]!)]}` : ''
  if (p.end === '') return uml ? `без окончания, только ${uml}` : 'без окончания, форма не меняется'
  return `окончание ${LABEL[p.end]}${uml ? ` и ${uml}` : ''}`
}

// при ошибке — как образована верная форма (верная кнопка отмечена «верно»); если окончание угадано — чего не хватило
function note(w: Noun, a: Pl): string {
  const [, p] = shown(w, null)
  if (p.end !== a.end) return how(w.lemma, p)
  return p.uml ? 'окончание угадал, не хватило умлаута' : 'окончание угадал, умлаут здесь не нужен'
}

export const plural: View<Pl> = {
  options: (w) => typesFor(w.lemma).map((t) => ({ a: t, label: typeLabel(t), show: <Type p={t} /> })),
  art: (w) => w.gender[0]!,
  ask: 'die …?',
  facts: (w, given) => {
    const ok = given !== null && right(w, given)
    const [form, p] = shown(w, ok ? given : null)
    const also = w.plural.filter((f) => f !== form)
    return {
      forms: (
        <>
          <Art g={w.gender[0]!} /> <span className="mono">{w.lemma}</span> · <Art g="pl" /> <Form form={form} p={p} />
          {also.length > 0 && <span className="also"> · также {also.join(', ')}</span>}
        </>
      ),
      note: given && !ok ? note(w, given) : undefined,
      number: 'pl',
      mark: 'g-pl',
      // правило судит о первой форме слова: при другой показанной форме («также») оно бы ей противоречило
      rule: form !== w.plural[0] ? null : {
        own: (
          <span className="mono">
            <Type p={p} />
          </span>
        ),
        part: (head) => (
          <>
            Как у последней части: <span className="mono">{head}</span>
          </>
        ),
        why: 'сложное слово берёт множественное последней части',
      },
    }
  },
  summary: (w) => (
    <>
      <span>
        <Art g={w.gender[0]!} /> <span className="mono">{w.lemma}</span> · <Art g="pl" /> <span className="mono">{w.plural[0]}</span>
      </span>
      {w.ru && <span className="sub">{w.ru}</span>}
    </>
  ),
}
