/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';

export interface DiscussionCommentValues {
  shipment: Record<string, string | number>;
  shipment_id: string | number;
  text: string;
  attachment: Array<string | number>;
}

export async function createDiscussionComment(
  api: Pick<APIClient, 'resource'>,
  values: DiscussionCommentValues,
): Promise<void> {
  // Files have already been uploaded. Link their IDs without requesting permission to edit the files themselves.
  await api.resource('shipment_comments').create({ values });
}
