import { Game } from './game/Game';

/**
 * Entry point. URL options (all optional):
 *   ?car=tuskroller     play as another vehicle (cindercrest, saberspring, shellfort, tuskroller)
 *   ?slot=0..3          grid slot (0 = inside of turn 1)
 *   ?laps=2             race length
 *   ?demo=1             all-AI race (camera follows the leader)
 *   ?catchup=0          disable the subtle catch-up assist
 *   ?reverse=1          experimental: run the course backwards
 */
async function main() {
  const params = new URLSearchParams(location.search);
  const loading = document.getElementById('loading')!;
  try {
    const game = await Game.create(document.getElementById('app')!, document.getElementById('hud')!, {
      playerVehicle: params.get('car') ?? undefined,
      playerSlot: params.has('slot') ? Number(params.get('slot')) : undefined,
      laps: params.has('laps') ? Number(params.get('laps')) : undefined,
      demo: params.get('demo') === '1',
      catchUp: params.get('catchup') !== '0',
      reverse: params.get('reverse') === '1',
    });
    (window as unknown as { game: Game }).game = game;
    loading.remove();
  } catch (err) {
    console.error(err);
    loading.textContent = `Failed to start: ${(err as Error).message}`;
  }
}

void main();
