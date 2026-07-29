# Arcade Arena — Voice Recording Script (with timing marks)

> Auto-generated from the show cue banks (`node scripts/generate-voice-script.mjs`).
> **Do not machine-generate the audio.** Prototype timing with the built-in
> synthetic voice, then re-record every line with a real person — ideally a
> local kaiako or rangatahi voicing the character. That is cheaper than a
> licence, sounds better, gets te reo right, and gives the school ownership.

## How to record

- **File name = cue id.** Save each take as `<id>.(webm|m4a|ogg)`. Keep the id
  and the length **stable** so a re-record is a drop-in replacement — the engine
  loads by id and expects the same duration in beats.
- **Record to a click at the show's BPM** (listed per show). Start each line on
  beat 1. Finish **within** its allotted beats (the "≈ seconds" column is that
  many beats at this BPM). Leave ~50 ms of silence head and tail so nothing
  clicks.
- **Calls are anticipatory.** The engine fires a `call` one bar before the move's
  scoring window, so deliver calls crisp and slightly ahead of the beat, not
  lazy. Count-ins land on the bar before the first move.
- **Rotation matters.** Praise/encourage lines rotate and never repeat back to
  back, so give each take its own energy — flat repeats are what make these
  games feel cheap.
- **Two languages, one grid.** Record the English and the te reo Māori takes to
  the **same** length so a show can switch language without retiming.

## te reo Māori

The te reo below is limited to correct core phrases as a placeholder. Before any
school sees this, a **kaiako must review, correct, and voice** the te reo lines —
expand them for variety if they wish, keeping ids and durations stable.


## Tarapī's Power-Up Party  `tarapi-power-up`

- **Tempo:** 128 BPM (1 beat ≈ 0.469 s), 4/4
- **Character voice:** Tarapī
- **Lines:** 66

| id | category | move | English | te reo Māori | beats | ≈ seconds |
| --- | --- | --- | --- | --- | --- | --- |
| `y78-count-in-0` | count-in |  | Ready... GO! | Tahi, rua! | 1 | 0.47 |
| `y78-count-in-1` | count-in |  | Three, two, one! | Rua, toru! | 1 | 0.47 |
| `y78-count-in-2` | count-in |  | Here it comes! | Tahi, rua! | 1 | 0.47 |
| `y78-count-in-3` | count-in |  | Get set! | Rua, toru! | 1 | 0.47 |
| `y78-count-in-4` | count-in |  | Power on! | Tahi, rua! | 1 | 0.47 |
| `y78-count-in-5` | count-in |  | Let's move! | Rua, toru! | 1 | 0.47 |
| `y78-call-jump-0` | call | jump | JUMP! | Peke! | 2 | 0.94 |
| `y78-call-jump-1` | call | jump | Boing! Up you go! | Peke! | 2 | 0.94 |
| `y78-call-jump-2` | call | jump | POWER JUMP! | Peke! | 2 | 0.94 |
| `y78-call-jump-3` | call | jump | Launch it! | Peke! | 2 | 0.94 |
| `y78-call-jump-4` | call | jump | Springs on — JUMP! | Peke! | 2 | 0.94 |
| `y78-call-duck-0` | call | duck | DUCK! | Piko! | 2 | 0.94 |
| `y78-call-duck-1` | call | duck | Down low! | Piko! | 2 | 0.94 |
| `y78-call-duck-2` | call | duck | Hide! Duck it! | Piko! | 2 | 0.94 |
| `y78-call-duck-3` | call | duck | Squish down! | Piko! | 2 | 0.94 |
| `y78-call-duck-4` | call | duck | Under the log — DUCK! | Piko! | 2 | 0.94 |
| `y78-call-reach-0` | call | reach | REACH! | Toro! | 2 | 0.94 |
| `y78-call-reach-1` | call | reach | Grab a star! | Toro! | 2 | 0.94 |
| `y78-call-reach-2` | call | reach | Stretch up tall! | Toro! | 2 | 0.94 |
| `y78-call-reach-3` | call | reach | Touch the sky! | Toro! | 2 | 0.94 |
| `y78-call-reach-4` | call | reach | Big reach! | Toro! | 2 | 0.94 |
| `y78-call-sidestep-0` | call | sidestep | STEP! | Taha! | 2 | 0.94 |
| `y78-call-sidestep-1` | call | sidestep | Slide across! | Taha! | 2 | 0.94 |
| `y78-call-sidestep-2` | call | sidestep | Zippy side-step! | Taha! | 2 | 0.94 |
| `y78-call-sidestep-3` | call | sidestep | Shuffle it! | Taha! | 2 | 0.94 |
| `y78-call-sidestep-4` | call | sidestep | Dodge sideways! | Taha! | 2 | 0.94 |
| `y78-praise-0` | praise |  | MEGA! | Ka pai! | 1 | 0.47 |
| `y78-praise-1` | praise |  | You did it! | Tino pai! | 1 | 0.47 |
| `y78-praise-2` | praise |  | So good! | Ka rawe! | 1 | 0.47 |
| `y78-praise-3` | praise |  | Power-up! | Mīharo! | 1 | 0.47 |
| `y78-praise-4` | praise |  | Legend! | Ka pai! | 1 | 0.47 |
| `y78-praise-5` | praise |  | Boom! | Tino pai! | 1 | 0.47 |
| `y78-praise-6` | praise |  | Nailed it! | Ka rawe! | 1 | 0.47 |
| `y78-praise-7` | praise |  | Too easy! | Mīharo! | 1 | 0.47 |
| `y78-praise-8` | praise |  | Superstar! | Ka pai! | 1 | 0.47 |
| `y78-praise-9` | praise |  | Yeah! | Tino pai! | 1 | 0.47 |
| `y78-praise-10` | praise |  | Sparkles! | Ka rawe! | 1 | 0.47 |
| `y78-praise-11` | praise |  | Champion! | Mīharo! | 1 | 0.47 |
| `y78-praise-12` | praise |  | Wowee! | Ka pai! | 1 | 0.47 |
| `y78-praise-13` | praise |  | Ka-pow! | Tino pai! | 1 | 0.47 |
| `y78-encourage-0` | encourage |  | Keep going! | Kia kaha! | 2 | 0.94 |
| `y78-encourage-1` | encourage |  | You've got this! | Kia kaha rā! | 2 | 0.94 |
| `y78-encourage-2` | encourage |  | Nearly! | Kōkiri! | 2 | 0.94 |
| `y78-encourage-3` | encourage |  | Try again! | Kia kaha! | 2 | 0.94 |
| `y78-encourage-4` | encourage |  | Come on team! | Kia kaha rā! | 2 | 0.94 |
| `y78-encourage-5` | encourage |  | Bring it! | Kōkiri! | 2 | 0.94 |
| `y78-encourage-6` | encourage |  | Big energy! | Kia kaha! | 2 | 0.94 |
| `y78-encourage-7` | encourage |  | Don't stop! | Kia kaha rā! | 2 | 0.94 |
| `y78-encourage-8` | encourage |  | Shake it out! | Kōkiri! | 2 | 0.94 |
| `y78-encourage-9` | encourage |  | Here we go! | Kia kaha! | 2 | 0.94 |
| `y78-transition-0` | transition |  | New move! | Anō! | 1 | 0.47 |
| `y78-transition-1` | transition |  | Switch it up! | Kia rite! | 1 | 0.47 |
| `y78-transition-2` | transition |  | Round two! | Anō! | 1 | 0.47 |
| `y78-transition-3` | transition |  | Faster now! | Kia rite! | 1 | 0.47 |
| `y78-transition-4` | transition |  | Level up! | Anō! | 1 | 0.47 |
| `y78-transition-5` | transition |  | Here's a tricky one! | Kia rite! | 1 | 0.47 |
| `y78-transition-6` | transition |  | Mix it up! | Anō! | 1 | 0.47 |
| `y78-transition-7` | transition |  | Big finish soon! | Kia rite! | 1 | 0.47 |
| `y78-idle-0` | idle |  | You awake back there? | Kei te pai? | 2 | 0.94 |
| `y78-idle-1` | idle |  | Give me a wiggle! | Kia kaha! | 2 | 0.94 |
| `y78-idle-2` | idle |  | Warm those legs! | Kei te pai? | 2 | 0.94 |
| `y78-idle-3` | idle |  | Bounce a bit! | Kia kaha! | 2 | 0.94 |
| `y78-idle-4` | idle |  | Show me something! | Kei te pai? | 2 | 0.94 |
| `y78-idle-5` | idle |  | Don't go to sleep! | Kia kaha! | 2 | 0.94 |
| `y78-idle-6` | idle |  | Wiggle wiggle! | Kei te pai? | 2 | 0.94 |
| `y78-idle-7` | idle |  | Let's gooo! | Kia kaha! | 2 | 0.94 |

## Baseline  `baseline`

- **Tempo:** 100 BPM (1 beat ≈ 0.600 s), 4/4
- **Character voice:** MC
- **Lines:** 66

| id | category | move | English | te reo Māori | beats | ≈ seconds |
| --- | --- | --- | --- | --- | --- | --- |
| `y910-count-in-0` | count-in |  | Count it in. | Tahi, rua! | 1 | 0.60 |
| `y910-count-in-1` | count-in |  | Four on the floor. | Rua, toru! | 1 | 0.60 |
| `y910-count-in-2` | count-in |  | From the top. | Tahi, rua! | 1 | 0.60 |
| `y910-count-in-3` | count-in |  | Here. | Rua, toru! | 1 | 0.60 |
| `y910-count-in-4` | count-in |  | On the one. | Tahi, rua! | 1 | 0.60 |
| `y910-count-in-5` | count-in |  | Go. | Rua, toru! | 1 | 0.60 |
| `y910-call-jump-0` | call | jump | Up. | Peke! | 2 | 1.20 |
| `y910-call-jump-1` | call | jump | Jump — on it. | Peke! | 2 | 1.20 |
| `y910-call-jump-2` | call | jump | Air. | Peke! | 2 | 1.20 |
| `y910-call-jump-3` | call | jump | Off the floor. | Peke! | 2 | 1.20 |
| `y910-call-jump-4` | call | jump | Lift. | Peke! | 2 | 1.20 |
| `y910-call-duck-0` | call | duck | Down. | Piko! | 2 | 1.20 |
| `y910-call-duck-1` | call | duck | Drop. | Piko! | 2 | 1.20 |
| `y910-call-duck-2` | call | duck | Under it. | Piko! | 2 | 1.20 |
| `y910-call-duck-3` | call | duck | Low. | Piko! | 2 | 1.20 |
| `y910-call-duck-4` | call | duck | Duck — clean. | Piko! | 2 | 1.20 |
| `y910-call-reach-0` | call | reach | Reach. | Toro! | 2 | 1.20 |
| `y910-call-reach-1` | call | reach | Up high. | Toro! | 2 | 1.20 |
| `y910-call-reach-2` | call | reach | Extend. | Toro! | 2 | 1.20 |
| `y910-call-reach-3` | call | reach | Full stretch. | Toro! | 2 | 1.20 |
| `y910-call-reach-4` | call | reach | Top. | Toro! | 2 | 1.20 |
| `y910-call-sidestep-0` | call | sidestep | Slide. | Taha! | 2 | 1.20 |
| `y910-call-sidestep-1` | call | sidestep | Off the line. | Taha! | 2 | 1.20 |
| `y910-call-sidestep-2` | call | sidestep | Shift. | Taha! | 2 | 1.20 |
| `y910-call-sidestep-3` | call | sidestep | Cut left, cut right. | Taha! | 2 | 1.20 |
| `y910-call-sidestep-4` | call | sidestep | Step out. | Taha! | 2 | 1.20 |
| `y910-praise-0` | praise |  | Clean. | Ka pai! | 1 | 0.60 |
| `y910-praise-1` | praise |  | That's it. | Tino pai! | 1 | 0.60 |
| `y910-praise-2` | praise |  | Locked in. | Ka rawe! | 1 | 0.60 |
| `y910-praise-3` | praise |  | Sharp. | Mīharo! | 1 | 0.60 |
| `y910-praise-4` | praise |  | Yeah, on beat. | Ka pai! | 1 | 0.60 |
| `y910-praise-5` | praise |  | Cold. | Tino pai! | 1 | 0.60 |
| `y910-praise-6` | praise |  | No misses. | Ka rawe! | 1 | 0.60 |
| `y910-praise-7` | praise |  | Crew's up. | Mīharo! | 1 | 0.60 |
| `y910-praise-8` | praise |  | Tidy. | Ka pai! | 1 | 0.60 |
| `y910-praise-9` | praise |  | On time. | Tino pai! | 1 | 0.60 |
| `y910-praise-10` | praise |  | Solid. | Ka rawe! | 1 | 0.60 |
| `y910-praise-11` | praise |  | Run it back. | Mīharo! | 1 | 0.60 |
| `y910-praise-12` | praise |  | Respect. | Ka pai! | 1 | 0.60 |
| `y910-praise-13` | praise |  | In the pocket. | Tino pai! | 1 | 0.60 |
| `y910-encourage-0` | encourage |  | Stay with it. | Kia kaha! | 2 | 1.20 |
| `y910-encourage-1` | encourage |  | Find the beat. | Kia kaha rā! | 2 | 1.20 |
| `y910-encourage-2` | encourage |  | Reset. | Kōkiri! | 2 | 1.20 |
| `y910-encourage-3` | encourage |  | Again. | Kia kaha! | 2 | 1.20 |
| `y910-encourage-4` | encourage |  | Hold the line. | Kia kaha rā! | 2 | 1.20 |
| `y910-encourage-5` | encourage |  | Lock in. | Kōkiri! | 2 | 1.20 |
| `y910-encourage-6` | encourage |  | Ride it. | Kia kaha! | 2 | 1.20 |
| `y910-encourage-7` | encourage |  | Don't drift. | Kia kaha rā! | 2 | 1.20 |
| `y910-encourage-8` | encourage |  | Back on time. | Kōkiri! | 2 | 1.20 |
| `y910-encourage-9` | encourage |  | Keep the count. | Kia kaha! | 2 | 1.20 |
| `y910-transition-0` | transition |  | Switch. | Anō! | 1 | 0.60 |
| `y910-transition-1` | transition |  | New pattern. | Kia rite! | 1 | 0.60 |
| `y910-transition-2` | transition |  | Double time coming. | Anō! | 1 | 0.60 |
| `y910-transition-3` | transition |  | Flip it. | Kia rite! | 1 | 0.60 |
| `y910-transition-4` | transition |  | Next phase. | Anō! | 1 | 0.60 |
| `y910-transition-5` | transition |  | Harder now. | Kia rite! | 1 | 0.60 |
| `y910-transition-6` | transition |  | Change up. | Anō! | 1 | 0.60 |
| `y910-transition-7` | transition |  | Last run. | Kia rite! | 1 | 0.60 |
| `y910-idle-0` | idle |  | Whole room, in. | Kei te pai? | 2 | 1.20 |
| `y910-idle-1` | idle |  | Back row — you're on. | Kia kaha! | 2 | 1.20 |
| `y910-idle-2` | idle |  | Move for the crew. | Kei te pai? | 2 | 1.20 |
| `y910-idle-3` | idle |  | Don't stall. | Kia kaha! | 2 | 1.20 |
| `y910-idle-4` | idle |  | Beat's still going. | Kei te pai? | 2 | 1.20 |
| `y910-idle-5` | idle |  | Step up. | Kia kaha! | 2 | 1.20 |
| `y910-idle-6` | idle |  | We're waiting. | Kei te pai? | 2 | 1.20 |
| `y910-idle-7` | idle |  | Show it. | Kia kaha! | 2 | 1.20 |

## Grid  `grid`

- **Tempo:** 120 BPM (1 beat ≈ 0.500 s), 4/4
- **Character voice:** — (no character; neutral count)
- **Lines:** 70

| id | category | move | English | te reo Māori | beats | ≈ seconds |
| --- | --- | --- | --- | --- | --- | --- |
| `grid-count-in-0` | count-in |  | One, two. | Tahi, rua! | 1 | 0.50 |
| `grid-count-in-1` | count-in |  | Two, three. | Rua, toru! | 1 | 0.50 |
| `grid-count-in-2` | count-in |  | From here. | Tahi, rua! | 1 | 0.50 |
| `grid-count-in-3` | count-in |  | Begin. | Rua, toru! | 1 | 0.50 |
| `grid-count-in-4` | count-in |  | Now. | Tahi, rua! | 1 | 0.50 |
| `grid-count-in-5` | count-in |  | Go. | Rua, toru! | 1 | 0.50 |
| `grid-count-in-6` | count-in |  | Ready. | Tahi, rua! | 1 | 0.50 |
| `grid-count-in-7` | count-in |  | Set. | Rua, toru! | 1 | 0.50 |
| `grid-call-jump-0` | call | jump | Up. | Peke! | 2 | 1.00 |
| `grid-call-jump-1` | call | jump | Rise. | Peke! | 2 | 1.00 |
| `grid-call-jump-2` | call | jump | Jump. | Peke! | 2 | 1.00 |
| `grid-call-jump-3` | call | jump | Lift. | Peke! | 2 | 1.00 |
| `grid-call-jump-4` | call | jump | Off. | Peke! | 2 | 1.00 |
| `grid-call-jump-5` | call | jump | Peak. | Peke! | 2 | 1.00 |
| `grid-call-duck-0` | call | duck | Down. | Piko! | 2 | 1.00 |
| `grid-call-duck-1` | call | duck | Low. | Piko! | 2 | 1.00 |
| `grid-call-duck-2` | call | duck | Duck. | Piko! | 2 | 1.00 |
| `grid-call-duck-3` | call | duck | Drop. | Piko! | 2 | 1.00 |
| `grid-call-duck-4` | call | duck | Under. | Piko! | 2 | 1.00 |
| `grid-call-duck-5` | call | duck | Fold. | Piko! | 2 | 1.00 |
| `grid-call-reach-0` | call | reach | Reach. | Toro! | 2 | 1.00 |
| `grid-call-reach-1` | call | reach | Up. | Toro! | 2 | 1.00 |
| `grid-call-reach-2` | call | reach | Extend. | Toro! | 2 | 1.00 |
| `grid-call-reach-3` | call | reach | Tall. | Toro! | 2 | 1.00 |
| `grid-call-reach-4` | call | reach | Top. | Toro! | 2 | 1.00 |
| `grid-call-reach-5` | call | reach | Open. | Toro! | 2 | 1.00 |
| `grid-call-sidestep-0` | call | sidestep | Side. | Taha! | 2 | 1.00 |
| `grid-call-sidestep-1` | call | sidestep | Across. | Taha! | 2 | 1.00 |
| `grid-call-sidestep-2` | call | sidestep | Step. | Taha! | 2 | 1.00 |
| `grid-call-sidestep-3` | call | sidestep | Shift. | Taha! | 2 | 1.00 |
| `grid-call-sidestep-4` | call | sidestep | Out. | Taha! | 2 | 1.00 |
| `grid-call-sidestep-5` | call | sidestep | Over. | Taha! | 2 | 1.00 |
| `grid-praise-0` | praise |  | Yes. | Ka pai! | 1 | 0.50 |
| `grid-praise-1` | praise |  | Good. | Tino pai! | 1 | 0.50 |
| `grid-praise-2` | praise |  | Match. | Ka rawe! | 1 | 0.50 |
| `grid-praise-3` | praise |  | On. | Mīharo! | 1 | 0.50 |
| `grid-praise-4` | praise |  | Set. | Ka pai! | 1 | 0.50 |
| `grid-praise-5` | praise |  | Done. | Tino pai! | 1 | 0.50 |
| `grid-praise-6` | praise |  | Clean. | Ka rawe! | 1 | 0.50 |
| `grid-praise-7` | praise |  | There. | Mīharo! | 1 | 0.50 |
| `grid-praise-8` | praise |  | Right. | Ka pai! | 1 | 0.50 |
| `grid-praise-9` | praise |  | Held. | Tino pai! | 1 | 0.50 |
| `grid-praise-10` | praise |  | Square. | Ka rawe! | 1 | 0.50 |
| `grid-praise-11` | praise |  | True. | Mīharo! | 1 | 0.50 |
| `grid-encourage-0` | encourage |  | Again. | Kia kaha! | 2 | 1.00 |
| `grid-encourage-1` | encourage |  | Keep time. | Kia kaha rā! | 2 | 1.00 |
| `grid-encourage-2` | encourage |  | Find it. | Kōkiri! | 2 | 1.00 |
| `grid-encourage-3` | encourage |  | Stay. | Kia kaha! | 2 | 1.00 |
| `grid-encourage-4` | encourage |  | Hold. | Kia kaha rā! | 2 | 1.00 |
| `grid-encourage-5` | encourage |  | Reset. | Kōkiri! | 2 | 1.00 |
| `grid-encourage-6` | encourage |  | Steady. | Kia kaha! | 2 | 1.00 |
| `grid-encourage-7` | encourage |  | In time. | Kia kaha rā! | 2 | 1.00 |
| `grid-encourage-8` | encourage |  | Line up. | Kōkiri! | 2 | 1.00 |
| `grid-encourage-9` | encourage |  | Hold form. | Kia kaha! | 2 | 1.00 |
| `grid-transition-0` | transition |  | Change. | Anō! | 1 | 0.50 |
| `grid-transition-1` | transition |  | Next. | Kia rite! | 1 | 0.50 |
| `grid-transition-2` | transition |  | Turn. | Anō! | 1 | 0.50 |
| `grid-transition-3` | transition |  | New shape. | Kia rite! | 1 | 0.50 |
| `grid-transition-4` | transition |  | Shift. | Anō! | 1 | 0.50 |
| `grid-transition-5` | transition |  | Again. | Kia rite! | 1 | 0.50 |
| `grid-transition-6` | transition |  | Rotate. | Anō! | 1 | 0.50 |
| `grid-transition-7` | transition |  | Reset form. | Kia rite! | 1 | 0.50 |
| `grid-idle-0` | idle |  | Move. | Kei te pai? | 2 | 1.00 |
| `grid-idle-1` | idle |  | With the beat. | Kia kaha! | 2 | 1.00 |
| `grid-idle-2` | idle |  | Your turn. | Kei te pai? | 2 | 1.00 |
| `grid-idle-3` | idle |  | Begin when ready. | Kia kaha! | 2 | 1.00 |
| `grid-idle-4` | idle |  | Step in. | Kei te pai? | 2 | 1.00 |
| `grid-idle-5` | idle |  | Now. | Kia kaha! | 2 | 1.00 |
| `grid-idle-6` | idle |  | Join in. | Kei te pai? | 2 | 1.00 |
| `grid-idle-7` | idle |  | Any time. | Kia kaha! | 2 | 1.00 |
