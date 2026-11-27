/* Term help. One entry per term id used as data-term in the app.
   c: concept id in data/concepts.json (text = its one_line, link = Map).
   n, t: name and text for UI-only terms (no concept, or text that the concept does not give).
   tab: what the control does in that tab. One sentence each. */
(function (root) {
  var TERMS = {
    /* Flow and measures */
    'throughput': { c: 'throughput', tab: {
      dice: 'Units that leave the last station.',
      flow: 'Units per day that leave the last stage.',
      tioe: 'T = price − material, per unit or per period.' } },
    'inventory': { c: 'inventory', tab: { tioe: 'ΔI is the change in money tied up in the system.' } },
    'oe': { c: 'operating-expense', tab: { tioe: 'ΔOE is the change in spend per period.' } },
    'global-measures': { c: 'global-measures' },
    'net-profit': { c: 'global-measures', n: 'Net profit (NP)', t: 'Net profit = throughput − operating expense, for one period.' },
    'roi': { c: 'global-measures', n: 'ROI', t: 'Return on investment = net profit ÷ inventory.' },
    'cash': { c: 'global-measures', n: 'Cash change', t: 'Money in minus money out in the first period: ΔNP − ΔI.' },
    'material': { c: 'throughput-accounting', n: 'Material', t: 'Truly variable cost per unit; only this cost is taken from price to get T.' },
    'wip': { c: 'wip-limit', n: 'WIP', t: 'Work in process: units that started but did not finish yet.', tab: {
      dice: 'Units in all queues after the round.',
      flow: 'Units in all queues, average over the days.',
      finder: 'Open items, counted by the stage they wait in.' } },
    'start-wip': { c: 'wip-limit', n: 'Start WIP', t: 'Units that already wait in front of a station when the run starts.', tab: {
      dice: 'Each station after station 1 starts with this many units in its queue.',
      flow: 'Units in the queue of this stage on day 1.' } },
    'lead-time': { c: 'four-time-elements', n: 'Lead time', t: 'Time from start to finish of one unit, including all waits.', tab: {
      flow: "From Little's Law: average WIP ÷ throughput per day.",
      finder: 'Median days from first start to last end of done items.' } },
    'littles-law': { c: 'littles-law', tab: { flow: 'Lead time = WIP ÷ throughput; less WIP gives shorter lead time.' } },
    'local-efficiency': { c: 'local-efficiency-fallacy', n: 'Local efficiency', t: 'Share of time a resource is busy; a high value does not mean more output.', tab: {
      flow: 'Average share of capacity that the stages used.' } },
    'dependent-events': { c: 'dependent-events' },
    'stations': { c: 'dependent-events', n: 'Stations', t: 'Steps in a line; each step can pass on only what the step before gave it.' },
    'seed': { n: 'Seed', t: 'Number that fixes the random values; the same seed gives the same run.' },
    'queue': { c: 'statistical-fluctuations', n: 'Queue', t: 'Units that wait in front of a step until it can work on them.' },
    'starved': { c: 'statistical-fluctuations', n: 'Starved', t: 'A step is starved when it can do more than the work that waits for it.', tab: {
      dice: 'Red; the station rolled more than its queue held, and that capacity is lost.' } },
    'expected': { c: 'matchstick-dice-game', n: 'Expected', t: 'Output if the line ran every round at the average of its slowest station.', tab: {
      dice: 'Rounds × the lowest average roll.' } },
    'short': { c: 'matchstick-dice-game', n: 'Short / ahead', t: 'Expected output minus real output; short means the line is behind.' },
    'avg-capacity': { c: 'balanced-plant-fallacy', n: 'Average capacity', t: 'What a resource can do on an average day, after normal losses.', tab: {
      dice: 'Rounds × the average roll of all stations; the line ships less than this.',
      flow: 'Cap/day × (1 − loss ÷ 2); the lowest bar is the constraint.' } },
    'cap-day': { c: 'bottleneck', n: 'Capacity per day', t: 'The most units a stage can do in one day with no loss.' },
    'loss': { c: 'statistical-fluctuations', n: 'Loss up to', t: 'Largest share of capacity a stage can lose on one day, from 0 to 1.', tab: {
      flow: 'Each day the stage loses a random share between 0 and this value.' } },
    'released': { c: 'rope', n: 'Released', t: 'New units let into the first station in this round.' },

    /* Constraint */
    'constraint': { c: 'identify-constraint', n: 'Constraint', t: 'The one resource or rule that limits the output of the whole system.', tab: {
      dice: 'The slow station; its die has the lowest average.',
      flow: 'The stage with the lowest average capacity.',
      finder: 'The stage that holds the most item-days.',
      tioe: 'The resource whose load at full demand is more than its capacity.' } },
    'bottleneck': { c: 'bottleneck' },
    'ccr': { c: 'capacity-constrained-resource', n: 'CCR', tab: { tioe: 'Yellow bar, load above 85% of capacity.' } },
    'dice-score': { c: 'matchstick-dice-game', n: 'Score', t: 'Score = mean of T% × I% over seeds 1–20, rounds 1 to current round. Grade follows it.' },
    'dice-t': { c: 'matchstick-dice-game', n: 'T%', t: 'T% = net shipped ÷ lowest roll total of the slowest-die stations. Balanced line: all stations. Max 100%.' },
    'this-seed': { c: 'matchstick-dice-game', n: 'This seed', t: 'Score, T% and I% of the shown seed only, rounds 1 to current round.' },
    'needed-wip': { c: 'wip-limit', n: 'I% (inventory)', t: 'Needed WIP = 2 × Herbie max roll + 1 per station. Avg WIP above it lowers I%.' },
    'optimal': { c: 'drum-buffer-rope', n: 'Optimal', t: 'Herbie position, rope, buffer and start WIP with the best mean score over seeds 1–20.' },
    'flow-net': { c: 'global-measures', n: 'Net/day', t: 'Net/day = T × out/day − OE − elevate cost − I cost × avg WIP; mean of seeds 1–20.' },
    'flow-optimal': { c: 'five-focusing-steps', n: 'Optimal', t: 'Exploit, rope buffer, +cap within budget and transfer batch with the best mean net/day.' },
    'service-level': { c: 'buffer-management', n: 'Service level', t: 'Share of samples that finish within the buffer; mean of seeds 1–20.' },
    'buffer-optimal': { c: 'buffer-management', n: 'Optimal buffer', t: 'Smallest whole buffer with service level at or above the target.' },
    'route-stages': { c: 'buffer', n: 'Stages to constraint', t: 'Number of steps between release and the constraint.' },
    'touch-time': { c: 'buffer', n: 'Route days', t: 'Planned days from release to the constraint, all steps together.' },
    'project-buffer': { c: 'buffer-management', n: 'Project buffer', t: 'Days added at the end of the critical chain to protect the due date.' },
    'feeding-buffer': { c: 'buffer-management', n: 'Feeding buffer', t: 'Days added where a feeding chain joins the critical chain.' },
    'herbie': { c: 'herbie-hike', n: 'Herbie', tab: { dice: 'The slow station, in red on the line.' } },
    'slow-station': { c: 'bottleneck', n: 'Slow station', t: 'A station with a smaller die, so its average output is lower than all others.', tab: {
      dice: 'Set its die range and its position on the line.' } },
    'die-range': { c: 'statistical-fluctuations', n: 'Die range', t: 'Lowest and highest value the station can roll in one round.', tab: {
      dice: 'Average output = (low + high) ÷ 2; 1–6 is a normal die.' } },
    'slow-pos': { c: 'herbie-hike', n: 'Position', t: 'Place of the slow station on the line, from 1 to the number of stations.' },
    'herbie-front': { c: 'herbie-hike', n: 'Herbie to front', t: 'Put the slowest step first, so it sets the pace and no work piles up behind it.', tab: {
      dice: 'Moves the slow station to position 1.' } },
    'drum': { c: 'drum-buffer-rope', n: 'Drum', t: 'The constraint; its pace sets the pace of release for the whole line.' },
    'dbr': { c: 'drum-buffer-rope', tab: { buffers: 'Each order is released one buffer before its due time at the constraint.' } },
    'rope': { c: 'rope', tab: {
      dice: 'Release new work only when the slow station takes it; this caps WIP.',
      flow: 'From the Subordinate step on, release follows the constraint.' } },
    'buffer': { c: 'buffer', tab: {
      dice: 'Most units allowed between station 1 and the slow station when rope is on.',
      flow: 'Units allowed in front of the constraint; 0 uses 2 days of its capacity.',
      buffers: 'Days from release to due time at the constraint.' } },
    'constraint-shift': { c: 'constraint-shift', n: 'Constraint moved', tab: { flow: 'After elevate, another stage became the constraint.' } },

    /* Five focusing steps */
    'five-focusing-steps': { c: 'five-focusing-steps' },
    'identify': { c: 'identify-constraint', tab: { flow: 'Run with no policy; it shows the constraint.' } },
    'exploit': { c: 'exploit-constraint', tab: { flow: 'The constraint loses no capacity to random loss.' } },
    'subordinate': { c: 'subordinate', tab: { flow: 'Adds the rope, so release follows the constraint.' } },
    'elevate': { c: 'elevate-constraint', tab: { flow: 'Multiplies the constraint capacity by elevate ×.' } },
    'repeat': { c: 'constraint-shift', n: 'Repeat', t: 'After you break a constraint, go back to step 1; do not let inertia become the constraint.', tab: {
      flow: 'Shows if the constraint moved to another stage.' } },

    /* Batches */
    'process-batch': { c: 'batch-size', n: 'Process batch', t: 'Units a resource makes before it changes over to another part.' },
    'transfer-batch': { c: 'batch-size', n: 'Transfer batch', t: 'Units moved to the next step at one time; it can be smaller than the process batch.', tab: {
      flow: 'From 1 to the process batch.' } },
    'setup': { c: 'batch-size', n: 'Setup', t: 'Time to change a resource from one part to another; no units come out.' },

    /* Finder */
    'pareto': { n: 'Pareto', t: 'Bars sorted from large to small with a running total; a few items cause most of the effect.' },
    'share-days': { c: 'identify-constraint', n: 'Share of days', t: 'Part of all item-days that items spent in the constraint stage.' },
    'wip-aging': { c: 'buffer-management', n: 'WIP aging', t: 'How long each open item has waited in the stage it is in now.' },
    'open': { n: 'Open', t: 'Items that started but have no end time yet.' },

    /* T·I·OE */
    'product-mix': { c: 'product-mix-pq' },
    't-per-min': { c: 'product-mix-pq', n: 'T per constraint minute', t: 'Throughput per unit ÷ minutes the unit needs on the constraint.' },
    'cost-world': { c: 'cost-world-vs-throughput-world', tab: { tioe: 'Cost view ranks by margin per unit; constraint view ranks by T per constraint minute.' } },
    'load': { c: 'bottleneck', n: 'Load', t: 'Minutes a resource needs to make the full demand of all products.' },

    /* Buffers */
    'penetration': { c: 'buffer-management', n: 'Buffer penetration', t: 'Share of the buffer time already used: (today − release) ÷ buffer.' },
    'zones': { c: 'buffer-management', n: 'Buffer zones', t: 'Buffer in thirds: green is fine, yellow is watch, red is expedite, black is late.' },
    'fever-chart': { c: 'critical-chain', n: 'Fever chart', t: 'Plot of buffer used against chain done; above the line the project is at risk.' },
    'chain-done': { c: 'critical-chain', n: 'Chain %', t: 'Share of the critical chain that is complete.' },
    'buffer-used': { c: 'critical-chain', n: 'Buffer %', t: 'Share of the project buffer that delays used.' },
    'critical-chain': { c: 'critical-chain' }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TERMS;
  else root.Goal.TERMS = TERMS;
})(this);
