/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';

type Entity = 'run' | 'shipment';
type Id = string | number;

export interface WorkspaceDiscussionMessage {
  id: Id;
  messageKey?: string;
  source?: string;
  text?: string;
  createdAt?: string;
  createdBy?: { id?: Id; nickname?: string; username?: string };
  attachment?: Array<{ id: Id; title?: string; filename?: string; url?: string; extname?: string; size?: number }>;
}

interface EntityRef {
  id: Id;
  run_number?: Id;
  shipment_number?: Id;
}
interface MessagePage {
  data: WorkspaceDiscussionMessage[];
  meta?: { count?: number };
}

export class WorkspaceDiscussionApi {
  constructor(private readonly api: Pick<APIClient, 'resource' | 'request'>) {}

  async list(origin: Entity, id: Id, page: number, pageSize: number) {
    const { runs, shipments } = await this.findScope(origin, id);
    const scopeKey = JSON.stringify([[...runs.keys()].sort(), [...shipments.keys()].sort()]);
    const limit = page * pageSize;
    const pages = await Promise.all([
      ...[...runs.values()].map(({ id, run_number }) =>
        this.activeSource('run', id, run_number, () =>
          this.api
            .request<MessagePage>({
              url: 'workspaceRunDiscussion:list',
              method: 'get',
              params: { runId: id, limit },
              skipNotify: true,
            })
            .then(({ data }) => data),
        ),
      ),
      ...[...shipments.values()].map(({ id, shipment_number }) =>
        this.activeSource('shipment', id, shipment_number, () =>
          this.api
            .resource('shipments.comments', id)
            .list(
              {
                page: 1,
                pageSize: limit,
                sort: ['-createdAt', '-id'],
                appends: ['createdBy', 'attachment'],
              },
              { skipNotify: true },
            )
            .then(({ data }) => data),
        ),
      ),
    ]);
    const result = pages
      .flatMap(({ data }) => data)
      .sort(
        (a, b) =>
          Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '') ||
          compareMessageIds(b.id, a.id) ||
          (b.messageKey ?? '').localeCompare(a.messageKey ?? ''),
      );
    return {
      data: result.slice(limit - pageSize, limit),
      meta: { count: pages.reduce((count, item) => count + (item.meta?.count ?? item.data.length), 0) },
      scopeKey: JSON.stringify([
        scopeKey,
        pages
          .map(({ readable }) => readable)
          .filter(Boolean)
          .sort(),
      ]),
    };
  }

  async send(runId: Id, text: string, attachmentIds: Id[]): Promise<void> {
    await this.api.resource('workspaceRunDiscussion').create({ values: { runId, text, attachmentIds } });
  }

  private async findScope(origin: Entity, id: Id) {
    const runs = new Map<string, EntityRef>();
    const shipments = new Map<string, EntityRef>();
    const collection = origin === 'run' ? 'transport_runs' : 'shipments';
    const numberField = origin === 'run' ? 'run_number' : 'shipment_number';
    const result = await this.api
      .resource(collection)
      .get({ filterByTk: id, fields: ['id', numberField] }, { skipNotify: true });
    const first: EntityRef = result.data.data;
    const frontier: Array<{ type: Entity; id: Id }> = [];
    add(origin, first);
    for (let index = 0; index < frontier.length; index += 1) {
      const current = frontier[index];
      const next = current.type === 'run' ? 'shipment' : 'run';
      const relation = current.type === 'run' ? 'transport_runs.shipments' : 'shipments.runs';
      const number = next === 'run' ? 'run_number' : 'shipment_number';
      const rows = await available(() =>
        this.api
          .resource(relation, current.id)
          .list(
            {
              paginate: false,
              fields: ['id', number],
              sort: ['id'],
            },
            { skipNotify: true },
          )
          .then(({ data }) => data.data as EntityRef[]),
      );
      for (const row of rows ?? []) add(next, row);
    }
    return { runs, shipments };

    function add(type: Entity, record: EntityRef) {
      const records = type === 'run' ? runs : shipments;
      if (records.has(String(record.id))) return;
      records.set(String(record.id), record);
      frontier.push({ type, id: record.id });
    }
  }

  private async activeSource(type: Entity, id: Id, number: Id | undefined, fetch: () => Promise<MessagePage>) {
    const response = await available(fetch);
    const name = type === 'run' ? 'Рейс' : 'Поставка';
    const source = number == null ? name : `${name} №${number}`;
    return {
      readable: response ? `${type}:${id}` : null,
      meta: response?.meta,
      data: (response?.data || []).map((message) => ({
        ...message,
        messageKey: `${type}:${message.id}`,
        source,
      })),
    };
  }
}

export function compareMessageIds(first: Id, second: Id): number {
  return String(first).localeCompare(String(second), undefined, { numeric: true });
}

async function available<T>(fetch: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fetch();
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status !== 403 && status !== 404) throw error;
  }
}
