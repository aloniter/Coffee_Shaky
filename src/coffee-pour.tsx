import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CoffeePourMenu, type CoffeeItem } from '@/components/ui/coffee-pour-menu';

// Visual interpretations of the existing menu, not measured kitchen recipes.
const coffees: CoffeeItem[] = [
  { id: 'house', name: 'הפוך הבית', subtitle: 'הכי בית שיש', description: 'אספרסו, חלב וקצף רך בכוס הבית', vessel: 'cup', layers: [{ type: 'espresso', amount: .3 }, { type: 'milk', amount: .44 }], foam: .14, art: 'heart' },
  { id: 'espresso', name: 'אספרסו', subtitle: 'קצר וחזק', description: 'אספרסו קצר עם קרמה זהובה', vessel: 'demitasse', layers: [{ type: 'espresso', amount: .72 }], crema: true },
  { id: 'macchiato', name: 'שקדיאטו', subtitle: 'הטאץ׳ השקדי', description: 'אספרסו עם נגיעה של חלב שקדים', vessel: 'demitasse', layers: [{ type: 'espresso', amount: .58 }, { type: 'milk', amount: .12 }], foam: .08 },
  { id: 'americano', name: 'אמריקנו', subtitle: 'אספרסו ומים', description: 'מים חמים ואספרסו נמזגים לכוס זכוכית', vessel: 'glass-mug', layers: [{ type: 'water', amount: .54 }, { type: 'espresso', amount: .24 }], crema: true, blend: .9 },
  { id: 'flatwhite', name: 'פלאט וויט', subtitle: 'חלב קטיפתי', description: 'אספרסו עם חלב קטיפתי ושכבת קצף דקה', vessel: 'cup', layers: [{ type: 'espresso', amount: .38 }, { type: 'milk', amount: .4 }], foam: .06, art: 'heart' },
  { id: 'latte', name: 'לאטה', subtitle: 'רך ומפנק', description: 'אספרסו, חלב חם וקצף בכוס גבוהה', vessel: 'tall-glass', layers: [{ type: 'espresso', amount: .25 }, { type: 'milk', amount: .51 }], foam: .11, blend: .15 },
];

function PourExperience() {
  const [selected, setSelected] = React.useState('house');
  const [classic, setClassic] = React.useState(new URLSearchParams(location.search).get('menu') === 'classic');
  const coffee = coffees.find(item => item.id === selected)!;

  React.useLayoutEffect(() => {
    document.documentElement.dataset.pourActive = String(!classic);
    return () => { delete document.documentElement.dataset.pourActive; };
  }, [classic]);

  return <>
    <div className="pour-switch" role="group" aria-label="תצוגת התפריט">
      <button type="button" aria-pressed={!classic} aria-controls="pourExperience" onClick={() => setClassic(false)}>תפריט במזיגה</button>
      <button type="button" aria-pressed={classic} aria-controls="classicMenu" onClick={() => setClassic(true)}>התפריט הקלאסי</button>
    </div>
    {!classic && <section className="pour-experience" id="pourExperience" aria-label="תפריט במזיגה">
      <div className="pour-caption" aria-hidden="true"><span>רגע לפני הלגימה.</span><span lang="en" dir="ltr">The Shaky pour.</span></div>
      <CoffeePourMenu items={coffees} value={selected} onValueChange={setSelected} />
      <button id="pourOrder" className="pour-order" type="button" onClick={event => {
        document.dispatchEvent(new CustomEvent('coffee:request', { detail: { kind: selected, trigger: event.currentTarget } }));
      }}><span>תכינו לי {coffee.name}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg></button>
      <p className="pour-hint">השם והבקשות המיוחדות בשלב הבא</p>
    </section>}
    {!classic && <p className="pour-more">בא לך משהו אחר?</p>}
  </>;
}

// Enhancement only: a missing or failed bundle leaves all eight original cards usable.
class PourBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { delete document.documentElement.dataset.pourActive; }
  render() { return this.state.failed ? null : this.props.children; }
}

const mount = document.getElementById('coffeePourRoot');
if (mount) createRoot(mount).render(<PourBoundary><PourExperience /></PourBoundary>);
