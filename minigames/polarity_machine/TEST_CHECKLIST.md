# Polarity Machine: hands-on test checklist

Open `PolarityMachine.tscn` and press F6. **F3** shows the numeric state, which helps confirm what you see.

## A. Every control responds
- [ ] **Water button.** It depresses and flashes, the pipes light cyan, the valve wheel spins, and water sprays from the spout onto the soil. The reservoir level drops and the porthole fills one mark. The cyan lamp lights.
- [ ] **Empty tank.** Press until empty (14 sprays). The button flashes orange and the spout only sputters. After about 8 s a trickle refills the tank.
- [ ] **Light wheel.** Drag, click and scroll it. The knob snaps to 4 detents and the spokes turn. The hub sun, the lamp bulb, the beam and the room brightness all change together.
- [ ] **Temperature lever.** Drag, click the gauge and scroll. At Cold: frost at the screen edges, a blue cast, and rime on the plant and cage. At Hot: an amber wash, embers and heat haze.
- [ ] **Age dial.** Drag the hand, click a station, or scroll. The hourglass runs and the plant grows or shrinks by stage.

## B. Plant reads (Young or Mature plant)
- [ ] **Dry:** pale, cracked soil and wilting leaves. **Waterlogged:** puddles and ripples on the soil, a slumping plant with yellowing leaves. It drains to Wet after 10 s.
- [ ] **Dark:** the leaves fold. **Low:** a pale, stretched plant. **Bright:** a lush plant with open leaves.
- [ ] **Cold:** frost crystals on the leaves. **Hot:** curled, brown leaf tips.
- [ ] **Growing in bad conditions** leaves lasting marks and the orange lamp comes on. Kept comfortable for 5 s, the marks fade and the green lamp returns.

## C. The solution path (see README)
- [ ] Healthy growth to Flowering (water between stages).
- [ ] At Flowering in Bright + Warm, there is no flower, even after waiting. A one-line nudge appears after 30 s.
- [ ] Cool + Medium gives a small closed bud. Low + Cool opens the violet flower.
- [ ] Two of {Moist, Bright, Warm} make the flower's heart glow. All three swell the fruit, and the petals fall.
- [ ] On success: the fruit glows, the machine pulses gold, steam vents, and the chime plays. **`puzzle_completed("polarity_fruit_key")` fires once.** All controls ignore input.
- [ ] **R** (`reset_puzzle()`) restarts, and everything works again.

## D. Recovery (no dead ends)
- [ ] Age → Old after flowering: the flowers wither. Age back → Flowering: the flower is back.
- [ ] Rewind below Flowering: the bloom is undone. Grow again: it works.
- [ ] Overwatered at the fruiting step: warm air dries Wet → Moist within 25 s, and the fruit then sets.
