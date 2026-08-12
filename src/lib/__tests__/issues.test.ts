import { describe, it, expect } from 'vitest';
import { filterQueueForModel } from '../issues';
import type { DiagnosticFlow } from '../flows';

// The queue actually run once the user answers (or skips) the model question.
// The invariant that matters: the bot must NEVER walk someone through another
// model's fix.
const flow = (id: string, modelId: string | null): DiagnosticFlow =>
  ({ id, sensor_model_id: modelId } as unknown as DiagnosticFlow);

const flows = [
  flow('gen1', null),
  flow('m1a', 'sm1'),
  flow('m1b', 'sm1'),
  flow('m2a', 'sm2'),
];

describe('filterQueueForModel', () => {
  it('with a model: that model’s flows plus the general ones, in rank order', () => {
    expect(filterQueueForModel(flows, 'sm1').map((f) => f.id)).toEqual(['gen1', 'm1a', 'm1b']);
  });
  it('without a model (user unsure): general flows ONLY — never another model’s fix', () => {
    expect(filterQueueForModel(flows, null).map((f) => f.id)).toEqual(['gen1']);
  });
  it('model with no specific flows still gets the general queue', () => {
    expect(filterQueueForModel(flows, 'sm999').map((f) => f.id)).toEqual(['gen1']);
  });
});
