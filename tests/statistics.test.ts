import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosHeaders } from 'axios';
import {
  parseStatistics,
  parseHighlights,
  searchRanking,
} from '../src/features/statistics/statistics.contracts';
import { StatisticsClient } from '../src/features/statistics/statistics.service';
import { EventRequestError } from '../src/features/events/events.service';
const id = '507f1f77bcf86cd799439011';
const row = {
  userId: id,
  firstName: 'João',
  lastName: 'Silva',
  goals: 7,
  assists: 3,
  position: 2,
};
const data = {
  period: { from: '2024-02-01', to: '2024-02-29' },
  finishedMatchCount: 1,
  scorers: [row],
  assistants: [row],
};

test('Statistics contracts validate civil periods, shared positions and safe counts; search preserves rank', () => {
  assert.deepEqual(parseStatistics(data), data);
  assert.equal(searchRanking([row], 'SILVA')[0]?.position, 2);
  assert.equal(searchRanking([row], 'joão')[0]?.position, 2);
  assert.equal(searchRanking([row], 'nobody').length, 0);
  for (const invalid of [
    null,
    { ...data, period: { from: '2023-02-29', to: '2023-03-01' } },
    { ...data, finishedMatchCount: -1 },
    { ...data, scorers: [{ ...row, position: 0 }] },
    { ...data, assistants: [{ ...row, assists: 1.2 }] },
  ])
    assert.throws(() => parseStatistics(invalid));
  assert.deepEqual(
    parseHighlights({ eventId: id, revision: 42, scorers: [], assistants: [] }),
    { eventId: id, revision: 42, scorers: [], assistants: [] },
  );
  assert.throws(() =>
    parseHighlights({
      eventId: id,
      revision: '42',
      scorers: [],
      assistants: [],
    }),
  );
});

test('Statistics client uses protected aggregate reads, explicit period and highlights; errors do not retry silently', async () => {
  const paths: string[] = [];
  const client = new StatisticsClient(async (path, body) => {
    assert.equal(body, undefined);
    paths.push(path);
    return {
      data: path.endsWith('/highlights')
        ? { eventId: id, revision: 1, scorers: [row], assistants: [] }
        : data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
  });
  await client.list();
  await client.list(data.period);
  await client.highlights(id);
  assert.deepEqual(paths, [
    '/statistics',
    '/statistics?from=2024-02-01&to=2024-02-29',
    `/events/${id}/highlights`,
  ]);
  let calls = 0;
  const error = new StatisticsClient(async () => {
    calls++;
    throw new Error('private detail');
  });
  await assert.rejects(
    () => error.list(),
    (failure: unknown) =>
      failure instanceof EventRequestError &&
      failure.status === 0 &&
      !failure.message.includes('private'),
  );
  assert.equal(calls, 1);
});
