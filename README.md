# ZOMBIE DEEP CITY

A top-down zombie-survival arena. Survive seven nights, hold the doors, and rebuild at dawn.

Live at the deployed URL of this repo. Uses Next.js (App Router) with a Postgres-backed leaderboard.

## THE STORY

The city went dark at 23:47 on the first night of autumn. The quarantine walls went up an hour later,
and every train that could leave already had. You were on the last one - the midnight freight that
drew up at the north junction and found the platform overrun. You made it off the rails, but the
doors of the city shut behind you. That was nine days ago.

Now the rails are the only map you trust. The mainline runs dead north to south through the city and
never breaks; the perimeter loop turns around the whole town through the jungle, so a survivor can
always find their way home. Every night the dead come out of the houses and the yards. Every dawn
they stop moving, and the workshop on the platform wakes up.

You are not clearing the city. You are learning its rhythms: which doors hold, which houses hide
infested dens, which trunks still carry ammunition. Outlast the nights, bank your scrap, and sharpen
the kit until the city belongs to you again.

## GAMEPLAY LOOP

1. **Night.** Waves of zombies spawn and hunt you. Doors of houses take hits as infested dens empty
   out - broken doors mean loot left behind, but also a hole in the dark. Search buildings, cars,
   crates and containers for supplies. Turrets you built can be placed with `T`.
2. **Dawn.** The wave is over. Zombies clear, the world regenerates, and the workshop opens: spend
   scrap on weapons, ammo, medkits, turrets and upgrade modules.
3. **Repeat.** Nights get harder - runners at night 4, brutes at night 6, crawlers from night 2.
   Death is permanent for the run: your score and best night go to the leaderboard.

Every run generates a fresh city (building layouts, cars, loot, containers) - the only constants are
the railway, the avenues and the workshop.

## CONTROLS

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| Mouse | Aim |
| Left click | Fire |
| Right click | Melee swing |
| **Mouse wheel** | **Switch weapon** |
| `1` `2` `3` `4` | Use CAN / RATION / MEDKIT / STIM |
| `E` | Search nearby loot |
| `T` | Place a sentry turret |
| `I` | **Open bag / inventory (pauses game)** |
| `R` | Reload |
| `M` | Sound on/off |
| `ESC` / `P` | Pause / resume |

## ITEMS AND WHAT THEY DO

| Item | Effect | Hotkey |
| --- | --- | --- |
| CAN | Heals 15 HP | `1` |
| RATION | Heals 30 HP | `2` |
| MEDKIT | Heals 50 HP | `3` |
| STIM | Heals 12 HP + 5s speed | `4` |
| SCRAP | Workshop currency - buy weapons, ammo, turrets, modules | - |

Items are used from the hotbar or the bag (`I`). Heals are wasted at full HP (except stim's speed
effect), so keep an eye on your bar.

## WEAPONS

| Weapon | Damage | Rate | Mag | Notes | Cost |
| --- | --- | --- | --- | --- | --- |
| PISTOL | 12 | 3.6/s | 12 | Starting gun | - |
| SMG | 8 | 9.5/s | 30 | Full auto | 35 scrap |
| SHOTGUN | 9 x6 | 1.35/s | 6 | Close range | 50 scrap |
| RIFLE | 26 | 2.3/s | 16 | Pierces 2 targets | 70 scrap |
| LMG | 13 | 7.5/s | 60 | Full auto heavy | 90 scrap |

Ammo is shared between mag and reserve; reserve packs refill the current weapon.

## MODULES (workshop upgrades)

| Module | Effect | Max level |
| --- | --- | --- |
| DAMAGE | +15% weapon damage | 5 |
| FIRE RATE | +10% fire rate | 5 |
| ENDURANCE | +25 max health | 5 |
| MOTION | +6% move speed | 4 |
| RELOAD | -12% reload time | 3 |

## ONLINE

- **Leaderboard** (`/leaderboard`): all-time scores, best night, kills.
- **Live stats**: total players and players online right now (heartbeat every 20s).
- Your best run is submitted automatically at death (once you have a name set in the start screen).
