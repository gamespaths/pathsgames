import { MatchCommandService, MATCH_STATUSES } from '../core/services/MatchCommandService';

function fakeMatch(over: any = {}) {
  return {
    id: 'm1', uuid: 'u1', guestId: 'g1', storyId: 's1', status: 'RUNNING',
    createdAt: new Date(), updatedAt: new Date(), endedAt: null, ...over,
  };
}

function makeService(initial: any) {
  const store: any = { match: initial };
  const matchRepo: any = {
    findByUuid: async (uuid: string) => (store.match && store.match.uuid === uuid ? store.match : null),
    update: async (_uuid: string, patch: any) => { store.match = { ...store.match, ...patch }; return store.match; },
    delete: async (_uuid: string) => { store.match = null; return true; },
  };
  const svc = new MatchCommandService(matchRepo, {} as any, {} as any, {} as any, {} as any);
  return { svc, store };
}

describe('MATCH_STATUSES', () => {
  it('flags ENDED and GAMEOVER as terminal', () => {
    const terminal = MATCH_STATUSES.filter(s => s.terminal).map(s => s.value);
    expect(terminal.sort()).toEqual(['ENDED', 'GAMEOVER']);
    expect(MATCH_STATUSES.find(s => s.value === 'RUNNING')!.terminal).toBe(false);
  });
});

describe('MatchCommandService.setStatus', () => {
  it('transitions to the requested status and returns UPDATED', async () => {
    const { svc, store } = makeService(fakeMatch({ status: 'RUNNING' }));
    const res = await svc.setStatus('u1', 'PAUSED');
    expect(res).toEqual({ status: 'UPDATED', uuid: 'u1' });
    expect(store.match.status).toBe('PAUSED');
  });

  it('throws MATCH_NOT_FOUND (404) for unknown match', async () => {
    const { svc } = makeService(null);
    await expect(svc.setStatus('nope', 'ENDED')).rejects.toMatchObject({ message: 'MATCH_NOT_FOUND', statusCode: 404 });
  });

  it('sets endedAt when stopping', async () => {
    const { svc, store } = makeService(fakeMatch({ status: 'RUNNING' }));
    await svc.setStatus('u1', 'ENDED');
    expect(store.match.status).toBe('ENDED');
    expect(store.match.endedAt).toBeInstanceOf(Date);
  });
});

describe('MatchCommandService.deleteMatch', () => {
  it('returns false when match not found', async () => {
    const { svc } = makeService(null);
    expect(await svc.deleteMatch('x')).toBe(false);
  });

  it('rejects deleting a non-terminal match with 409', async () => {
    const { svc } = makeService(fakeMatch({ status: 'RUNNING' }));
    await expect(svc.deleteMatch('u1')).rejects.toMatchObject({ message: 'MATCH_NOT_STOPPED', statusCode: 409 });
  });

  it('deletes a terminal match', async () => {
    const { svc, store } = makeService(fakeMatch({ status: 'ENDED' }));
    expect(await svc.deleteMatch('u1')).toBe(true);
    expect(store.match).toBeNull();
  });
});
