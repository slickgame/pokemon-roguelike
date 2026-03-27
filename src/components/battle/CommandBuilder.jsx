import React from "react";

// ── Type chart ─────────────────────────────────────────────────────────────────
const TYPECHART = {
  normal:   { normal:1, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:1,  flying:1,  rock:0.5, ghost:0,  dragon:1,  ice:1,   fighting:1, psychic:1, dark:1,   steel:0.5 },
  fire:     { normal:1, fire:0.5, water:0.5, grass:2,   electric:1,   bug:2,   poison:1,  flying:1,  rock:0.5, ghost:1,  dragon:0.5,ice:2,   fighting:1, psychic:1, dark:1,   steel:2   },
  water:    { normal:1, fire:2,   water:0.5, grass:0.5, electric:1,   bug:1,   poison:1,  flying:1,  rock:2,   ghost:1,  dragon:0.5,ice:1,   fighting:1, psychic:1, dark:1,   steel:1   },
  grass:    { normal:1, fire:0.5, water:2,   grass:0.5, electric:1,   bug:0.5, poison:0.5,flying:0.5,rock:2,   ghost:1,  dragon:0.5,ice:1,   fighting:1, psychic:1, dark:1,   steel:0.5 },
  electric: { normal:1, fire:1,   water:2,   grass:0.5, electric:0.5, bug:1,   poison:1,  flying:2,  rock:1,   ghost:1,  dragon:0.5,ice:1,   fighting:1, psychic:1, dark:1,   steel:1   },
  bug:      { normal:1, fire:0.5, water:1,   grass:2,   electric:1,   bug:1,   poison:0.5,flying:0.5,rock:1,   ghost:0.5,dragon:1,  ice:1,   fighting:0.5,psychic:2,dark:2,  steel:0.5 },
  poison:   { normal:1, fire:1,   water:1,   grass:2,   electric:1,   bug:1,   poison:0.5,flying:1,  rock:0.5, ghost:1,  dragon:1,  ice:1,   fighting:1, psychic:1, dark:1,   steel:0   },
  flying:   { normal:1, fire:1,   water:1,   grass:2,   electric:0.5, bug:2,   poison:1,  flying:1,  rock:0.5, ghost:1,  dragon:1,  ice:1,   fighting:2, psychic:1, dark:1,   steel:0.5 },
  rock:     { normal:1, fire:2,   water:1,   grass:1,   electric:1,   bug:2,   poison:1,  flying:2,  rock:1,   ghost:1,  dragon:1,  ice:2,   fighting:0.5,psychic:1,dark:1,  steel:0.5 },
  ghost:    { normal:0, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:1,  flying:1,  rock:1,   ghost:2,  dragon:1,  ice:1,   fighting:0, psychic:2, dark:0.5, steel:1   },
  dragon:   { normal:1, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:1,  flying:1,  rock:1,   ghost:1,  dragon:2,  ice:1,   fighting:1, psychic:1, dark:1,   steel:0.5 },
  ice:      { normal:1, fire:0.5, water:0.5, grass:2,   electric:1,   bug:1,   poison:1,  flying:2,  rock:1,   ghost:1,  dragon:2,  ice:0.5, fighting:1, psychic:1, dark:1,   steel:0.5 },
  fighting: { normal:2, fire:1,   water:1,   grass:1,   electric:1,   bug:0.5, poison:0.5,flying:0.5,rock:2,   ghost:0,  dragon:1,  ice:2,   fighting:1, psychic:0.5,dark:2, steel:2   },
  psychic:  { normal:1, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:2,  flying:1,  rock:1,   ghost:1,  dragon:1,  ice:1,   fighting:2, psychic:0.5,dark:0,  steel:1   },
  dark:     { normal:1, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:1,  flying:1,  rock:1,   ghost:2,  dragon:1,  ice:1,   fighting:0.5,psychic:2,dark:0.5, steel:1  },
  steel:    { normal:1, fire:0.5, water:0.5, grass:1,   electric:0.5, bug:1,   poison:0,  flying:1,  rock:2,   ghost:1,  dragon:1,  ice:2,   fighting:1, psychic:1, dark:1,   steel:0.5 },
};

function typeEffectiveness(moveType, defenderTypes = []) {
  let mult = 1;
  for (const dt of defenderTypes) mult *= (TYPECHART[moveType]?.[dt] ?? 1);
  return mult;
}

function estimateDamageRange(attacker, move, defender) {
  if (!move?.power || !attacker || !defender) return null;
  const lvl = attacker.level ?? 5;
  const isSpecial = move.category === "special";
  const atkStat = (isSpecial ? attacker.stats?.spa : attacker.stats?.atk) ?? 10;
  const defStat = (isSpecial ? defender.stats?.spd : defender.stats?.def) ?? 10;
  const stab = attacker.types?.includes(move.type) ? 1.5 : 1;
  const typeEff = typeEffectiveness(move.type, defender.types ?? []);
  const base = Math.floor(Math.floor(2 * lvl / 5 + 2) * move.power * atkStat / defStat / 50 + 2);
  const minDmg = Math.max(1, Math.floor(base * stab * typeEff * 0.85));
  const maxDmg = Math.max(1, Math.floor(base * stab * typeEff * 1.0));
  return { minDmg, maxDmg, typeEff };
}

// Build valid item targets for a given itemId across the full party (active then bench)
function getItemTargets(itemId, playerActive, playerBench) {
  const fullParty = [
    ...playerActive.map((p, i) => ({ p, partyIndex: i })),
    ...playerBench.map((p, i) => ({ p, partyIndex: playerActive.length + i })),
  ];
  if (itemId === "potion") {
    return fullParty.filter(({ p }) => p && !p.fainted && p.currentHp < p.maxHp);
  }
  if (itemId === "revive") {
    return fullParty.filter(({ p }) => p && p.fainted);
  }
  return [];
}

export default function CommandBuilder({ playerActive, playerBench, commands, onChange, enemyActive, inventory = {} }) {
  const aliveActive = playerActive.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.fainted);
  const aliveBench = playerBench.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.fainted);
  const aliveEnemyTargets = enemyActive.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.fainted);
  const hasBagItems = (inventory.potion ?? 0) > 0 || (inventory.revive ?? 0) > 0;

  return (
    <div className="space-y-3">
      {aliveActive.map(({ p: poke, i: slot }) => {
        const cmd = commands[slot] ?? {
          actorSlot: slot, type: "move",
          moveId: poke.moves[0]?.id,
          target: { side: "enemy", slot: aliveEnemyTargets[0]?.i ?? 0 },
        };

        // For item commands, compute default item and target
        const defaultItemId = (inventory.potion ?? 0) > 0 ? "potion" : "revive";
        const currentItemId = cmd.type === "item" ? (cmd.itemId ?? defaultItemId) : defaultItemId;
        const itemTargets = getItemTargets(currentItemId, playerActive, playerBench);
        const defaultTargetPartyIndex = itemTargets[0]?.partyIndex ?? 0;

        return (
          <div key={slot} className="bg-white/4 border border-white/8 rounded-xl p-3">
            <p className="text-white/70 text-xs font-semibold mb-2 uppercase tracking-wide">
              {poke.name} <span className="text-white/30 normal-case font-normal">({poke.currentHp}/{poke.maxHp} HP)</span>
            </p>

            {/* Action type tabs */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => onChange(slot, {
                  actorSlot: slot, type: "move",
                  moveId: poke.moves[0]?.id,
                  target: { side: "enemy", slot: aliveEnemyTargets[0]?.i ?? 0 },
                })}
                className={`text-xs px-2 py-0.5 rounded ${cmd.type === "move" ? "bg-violet-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
              >
                Move
              </button>
              {aliveBench.length > 0 && (
                <button
                  onClick={() => onChange(slot, {
                    actorSlot: slot, type: "switch",
                    target: { slot: aliveBench[0].i },
                  })}
                  className={`text-xs px-2 py-0.5 rounded ${cmd.type === "switch" ? "bg-amber-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                >
                  Switch
                </button>
              )}
              {hasBagItems && (
                <button
                  onClick={() => onChange(slot, {
                    actorSlot: slot, type: "item",
                    itemId: defaultItemId,
                    target: { partyIndex: getItemTargets(defaultItemId, playerActive, playerBench)[0]?.partyIndex ?? 0 },
                  })}
                  className={`text-xs px-2 py-0.5 rounded ${cmd.type === "item" ? "bg-emerald-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                >
                  Bag
                </button>
              )}
            </div>

            {cmd.type === "move" && (() => {
              const selectedMove = poke.moves.find(m => m.id === cmd.moveId);
              const targetSlot = cmd.target?.slot ?? aliveEnemyTargets[0]?.i ?? 0;
              const targetPoke = aliveEnemyTargets.find(({ i }) => i === targetSlot)?.p ?? aliveEnemyTargets[0]?.p;
              const dmgEst = selectedMove ? estimateDamageRange(poke, selectedMove, targetPoke) : null;
              const effText = dmgEst
                ? dmgEst.typeEff >= 2 ? "Super effective!" : dmgEst.typeEff <= 0.5 ? "Not very effective…" : dmgEst.typeEff === 0 ? "No effect" : null
                : null;
              const effColor = dmgEst
                ? dmgEst.typeEff >= 2 ? "text-emerald-400" : dmgEst.typeEff === 0 ? "text-white/30" : dmgEst.typeEff < 1 ? "text-red-400" : "text-white/40"
                : "text-white/40";

              return (
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={cmd.moveId}
                      onChange={e => onChange(slot, { ...cmd, moveId: e.target.value })}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50 min-w-0"
                    >
                      {poke.moves.map(m => (
                        <option key={m.id} value={m.id} className="bg-gray-900">
                          {m.name} {m.power ? `(${m.power}BP)` : "(Status)"} PP:{m.currentPp ?? m.pp}
                        </option>
                      ))}
                    </select>
                    <select
                      value={targetSlot}
                      onChange={e => onChange(slot, { ...cmd, target: { side: "enemy", slot: Number(e.target.value) } })}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                    >
                      {aliveEnemyTargets.map(({ p, i }) => (
                        <option key={i} value={i} className="bg-gray-900">→ {p.name}</option>
                      ))}
                    </select>
                  </div>
                  {dmgEst && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-white/30 text-[10px]">Est. dmg:</span>
                      <span className="text-white/70 text-[11px] font-mono font-semibold">
                        {dmgEst.minDmg}–{dmgEst.maxDmg}
                        {targetPoke?.maxHp ? (
                          <span className="text-white/30 font-normal ml-1">
                            ({Math.round(dmgEst.minDmg / targetPoke.maxHp * 100)}–{Math.round(dmgEst.maxDmg / targetPoke.maxHp * 100)}%)
                          </span>
                        ) : null}
                      </span>
                      {effText && <span className={`text-[10px] font-semibold ${effColor}`}>{effText}</span>}
                    </div>
                  )}
                  {selectedMove && !selectedMove.power && (
                    <div className="px-1">
                      <span className="text-white/30 text-[10px]">Status move — no damage</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {cmd.type === "switch" && (
              <select
                value={cmd.target?.slot ?? aliveBench[0]?.i ?? 0}
                onChange={e => onChange(slot, { ...cmd, target: { slot: Number(e.target.value) } })}
                className="w-full bg-white/5 border border-amber-500/30 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                {aliveBench.map(({ p, i }) => (
                  <option key={i} value={i} className="bg-gray-900">
                    ↩ {p.name} ({p.currentHp}/{p.maxHp} HP)
                  </option>
                ))}
              </select>
            )}

            {cmd.type === "item" && (
              <div className="flex gap-2 flex-wrap">
                <select
                  value={currentItemId}
                  onChange={e => {
                    const newItem = e.target.value;
                    const targets = getItemTargets(newItem, playerActive, playerBench);
                    onChange(slot, { ...cmd, itemId: newItem, target: { partyIndex: targets[0]?.partyIndex ?? 0 } });
                  }}
                  className="bg-white/5 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  {(inventory.potion ?? 0) > 0 && <option value="potion" className="bg-gray-900">💊 Potion ×{inventory.potion}</option>}
                  {(inventory.revive ?? 0) > 0 && <option value="revive" className="bg-gray-900">💫 Revive ×{inventory.revive}</option>}
                </select>
                <select
                  value={cmd.target?.partyIndex ?? defaultTargetPartyIndex}
                  onChange={e => onChange(slot, { ...cmd, target: { partyIndex: Number(e.target.value) } })}
                  className="flex-1 bg-white/5 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 min-w-0"
                >
                  {itemTargets.length === 0
                    ? <option value={0} className="bg-gray-900">No valid targets</option>
                    : itemTargets.map(({ p, partyIndex }) => (
                        <option key={partyIndex} value={partyIndex} className="bg-gray-900">
                          {p.name} ({p.currentHp}/{p.maxHp} HP)
                        </option>
                      ))
                  }
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}