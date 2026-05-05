import type { Shard, ShardStatusSnapshot } from '@br/types';
import { A } from '@solidjs/router';
import type { Component } from 'solid-js';

export interface ShardCardProps {
  readonly shard: Shard;
  readonly status: ShardStatusSnapshot | undefined;
}

const KIND_LABEL: Record<Shard['kind'], string> = {
  order: 'Order',
  chaos: 'Chaos',
  gm: 'Campaign',
};

const KIND_COLOR: Record<Shard['kind'], string> = {
  order: 'var(--br-virtue-300)',
  chaos: 'var(--br-blood-300)',
  gm: 'var(--br-mana-300)',
};

const HEALTH_COLOR: Record<NonNullable<ShardStatusSnapshot['health']>, string> = {
  green: 'var(--br-success)',
  amber: 'var(--br-warning)',
  red: 'var(--br-danger)',
};

const REGION_LABEL: Record<Shard['region'], string> = {
  'na-east': 'North America East',
  'na-west': 'North America West',
  'eu-west': 'Europe West',
  'eu-central': 'Europe Central',
  apac: 'Asia Pacific',
  sa: 'South America',
};

export const ShardCard: Component<ShardCardProps> = (props) => {
  const populationPct = (): number => {
    if (props.shard.capacity === 0) return 0;
    return Math.min(100, Math.round((props.shard.population / props.shard.capacity) * 100));
  };
  const health = (): NonNullable<ShardStatusSnapshot['health']> => props.status?.health ?? 'green';

  return (
    <article class="shard-card" aria-labelledby={`shard-${props.shard.id}-name`}>
      <header class="shard-card__head">
        <span class="shard-card__kind" style={{ color: KIND_COLOR[props.shard.kind] }}>
          {KIND_LABEL[props.shard.kind]} World
        </span>
        <span
          class="shard-card__health"
          style={{ '--health': HEALTH_COLOR[health()] }}
          aria-label={`Server health: ${health()}`}
        >
          <span class="shard-card__dot" aria-hidden="true" />
          {props.status?.status ?? props.shard.status}
        </span>
      </header>
      <h3 id={`shard-${props.shard.id}-name`} class="shard-card__name">
        {props.shard.name}
      </h3>
      <p class="shard-card__motd">"{props.shard.motd}"</p>
      <p class="shard-card__description">{props.shard.description}</p>
      <dl class="shard-card__stats">
        <div>
          <dt>Region</dt>
          <dd>{REGION_LABEL[props.shard.region]}</dd>
        </div>
        <div>
          <dt>Population</dt>
          <dd>
            {props.shard.population.toLocaleString()}
            <span class="shard-card__capacity">
              {' / '}
              {props.shard.capacity.toLocaleString()}
            </span>
          </dd>
        </div>
        <div>
          <dt>Tick rate</dt>
          <dd>{props.shard.tickRateHz} Hz</dd>
        </div>
        {props.status?.queueLength !== undefined && props.status.queueLength > 0 && (
          <div>
            <dt>Queue</dt>
            <dd>{props.status.queueLength}</dd>
          </div>
        )}
      </dl>
      <div class="shard-card__bar" aria-hidden="true">
        <div class="shard-card__bar-fill" style={{ width: `${populationPct()}%` }} />
      </div>
      <A href="/join" class="shard-card__cta">
        View World →
      </A>
      <style>{SHARD_CSS}</style>
    </article>
  );
};

const SHARD_CSS = `
.shard-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  background: linear-gradient(180deg, rgba(20, 17, 12, 0.78) 0%, rgba(8, 7, 5, 0.85) 100%);
  border: 1px solid rgba(207, 150, 47, 0.22);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}
.shard-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.shard-card__kind {
  font-family: var(--br-font-ui);
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
}
.shard-card__health {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--br-parchment-200);
}
.shard-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--health, var(--br-success));
  box-shadow: 0 0 6px var(--health);
}
.shard-card__name {
  font-size: 1.5rem;
  margin: 4px 0 0;
}
.shard-card__motd {
  color: var(--br-parchment-300);
  font-style: italic;
  font-size: 0.875rem;
  margin: 0;
}
.shard-card__description {
  color: var(--br-parchment-100);
  font-size: 0.9375rem;
  margin: 0;
}
.shard-card__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 0;
  padding: 0;
}
.shard-card__stats > div { margin: 0; }
.shard-card__stats dt {
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--br-parchment-300);
  margin: 0 0 2px;
}
.shard-card__stats dd {
  margin: 0;
  font-size: 0.875rem;
  color: var(--br-parchment-50);
}
.shard-card__capacity { color: var(--br-parchment-300); }
.shard-card__bar {
  height: 4px;
  background: rgba(207, 150, 47, 0.12);
  border-radius: 2px;
  overflow: hidden;
}
.shard-card__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--br-sigil-500), var(--br-sigil-300));
  transition: width 240ms;
}
.shard-card__cta {
  align-self: flex-start;
  font-family: var(--br-font-ui);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 8px 14px;
  border: 1px solid var(--br-sigil-500);
  color: var(--br-sigil-200);
  border-radius: 2px;
  text-decoration: none;
  transition: background 160ms, color 160ms;
}
.shard-card__cta:hover {
  background: var(--br-sigil-500);
  color: var(--br-ink-900);
  text-decoration: none;
}
`;
