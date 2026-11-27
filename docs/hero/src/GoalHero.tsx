import { Bar, Card, Roll, Stage, Toggle, Window, type Act } from '../../kit'
import './goal-hero.css'

// The Goal toolkit README hero. The app shows the verdict, then one
// "what if" toggle proves the fix.
// Data: the fictional Northwind demo pipeline (examples/demo-crm).

type S = {
  loaded: boolean
  rope: boolean
}

const initial: S = { loaded: false, rope: false }
const POSTER: S = { loaded: true, rope: true }

// Pareto of deal-days by stage. Only the constraint has a real label.
const PARETO = [
  { label: 'security review', v: 45 },
  { v: 12, w: 46 },
  { v: 11, w: 52 },
  { v: 10, w: 38 },
  { v: 10, w: 56 },
  { v: 6, w: 34 },
]

async function script(a: Act<S>) {
  await a.wait(900)
  await a.set({ loaded: true })
  await a.wait(1600)
  await a.move('rope')
  await a.wait(250)
  await a.click()
  await a.set({ rope: true })
  await a.mark('payoff')
  await a.move('rest')
  await a.wait(3200)
  // Rewind in place, last change first, so the loop opens where it began.
  await a.set({ rope: false })
  await a.wait(70)
  await a.set({ loaded: false })
  await a.wait(300)
}

export function GoalHero() {
  return (
    <Stage
      width={1100}
      height={400}
      compact={{ below: 700, width: 358, height: 296 }}
      initial={initial}
      poster={POSTER}
      script={script}
      cursor={{ at: { wide: { x: 600, y: 372 }, compact: { x: 300, y: 262 } } }}
      className="gh"
    >
      {(s, _rect, layout) => (
        <>
          <Window url="localhost/#/finder?run=c040a436" urlShape="pill" className="gh-app">
            <div className="gh-page">
              {layout === 'wide' && <div className="gh-nav">
                <span className="gh-brand">The Goal</span>
                <span className="gh-tab" data-on>Bottleneck finder</span>
                <Bar w={44} h={6} tone={2} />
                <Bar w={30} h={6} tone={2} />
                {layout === 'wide' && <Bar w={52} h={6} tone={2} />}
                {layout === 'wide' && <Bar w={38} h={6} tone={2} />}
              </div>}

              <div className="gh-stack">
              <div className="gh-skel" data-hide={s.loaded || undefined} aria-hidden>
                <div>
                  <Bar w={170} h={8} tone={2} />
                  <Bar w={layout === 'wide' ? 440 : 280} h={26} r={5} tone={2} style={{ marginTop: 16 }} />
                  <div className="gh-skel-n">
                    <Bar w={64} h={26} r={4} tone={2} />
                    <Bar w={72} h={26} r={4} tone={2} />
                    <Bar w={56} h={26} r={4} tone={2} />
                  </div>
                  <Bar w={layout === 'wide' ? 520 : 326} h={46} r={10} tone={1} style={{ marginTop: 26 }} />
                </div>
                {layout === 'wide' && (
                  <Card gap={0} className="gh-card gh-card--skel">
                    <div className="gh-card-h"><Bar w={140} h={8} tone={2} /></div>
                    {[100, 27, 24, 22, 21, 13].map((w, i) => (
                      <div key={i} className="gh-pr"><span className="gh-pl"><Bar w={[84, 46, 52, 38, 56, 34][i]} h={6} tone={2} /></span><span className="gh-pb gh-pb--skel" style={{ width: `${w}%` }} /><span /></div>
                    ))}
                  </Card>
                )}
              </div>
              <div className="gh-body" data-loaded={s.loaded || undefined}>
                <div className="gh-verdict">
                  <div className="gh-q">Which stage sets the pace?</div>
                  <div className="gh-h">
                    <span className="gh-con">Security review</span> is the constraint.
                  </div>
                  <div className="gh-nums">
                    <div className="gh-num gh-num--con">
                      <b>45<small>%</small></b>
                      <span>of deal-days</span>
                    </div>
                    <div className="gh-num">
                      <b>15.2<small>d</small></b>
                      <span>median wait</span>
                    </div>
                    <div className="gh-num">
                      <b>7<small>open</small></b>
                      <span>deals in queue</span>
                    </div>
                  </div>

                  <Card tone="sunken" pad="small" className="gh-whatif">
                    <span className="gh-wk">What if</span>
                    <span className="gh-rope">
                      <Toggle on={s.rope} data-target="rope" data-cursor="pointer" />
                      Rope
                    </span>
                    <span className="gh-results">
                    <span className="gh-res" data-good={s.rope || undefined}>
                      <span className="gh-slot"><Roll>{s.rope ? '6' : '116'}</Roll></span>
                      <span className="gh-u">WIP</span>
                      <span className="gh-was" data-show={s.rope || undefined}>was 116</span>
                    </span>
                    <span className="gh-res" data-good={s.rope || undefined}>
                      <span className="gh-slot"><Roll delay={150}>{s.rope ? '6.0' : '4.2'}</Roll></span>
                      <span className="gh-u">{layout === 'wide' ? 'deals / day' : '/ day'}</span>
                      <span className="gh-was" data-show={s.rope || undefined}>was 4.2</span>
                    </span>
                    </span>
                  </Card>
                </div>

                {layout === 'wide' && (<div className="gh-right">
                  <Card gap={0} className="gh-card">
                    <div className="gh-card-h">Where the deal-days go</div>
                    {PARETO.map((p, i) => (
                      <div key={i} className="gh-pr">
                        {p.label ? <span className="gh-pl">{p.label}</span> : <span className="gh-pl"><Bar w={p.w!} h={6} tone={2} /></span>}
                        <span className="gh-pb" style={{ width: `${(p.v / 45) * 100}%` }} data-con={i === 0 || undefined} />
                        <span className="gh-pv">{p.v}%</span>
                      </div>
                    ))}
                  </Card>
                </div>)}
              </div>
              </div>
            </div>
          </Window>

          <span data-target="rest" className="gh-rest" />
        </>
      )}
    </Stage>
  )
}
