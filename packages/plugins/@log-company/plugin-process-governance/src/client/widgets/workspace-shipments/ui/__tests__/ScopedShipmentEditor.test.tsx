/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowEngine, FlowEngineProvider, FlowModel, FlowModelRenderer } from '@nocobase/flow-engine';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScopedShipmentEditor } from '../ScopedShipmentEditor';

class RecordProbe extends FlowModel {
  render() {
    return <span data-testid="shipment-record">{this.context.view.inputArgs.filterByTk}</span>;
  }
}

function setup() {
  const engine = new FlowEngine();
  const view = { inputArgs: { filterByTk: '10:100', workspaceRunId: '10', workspaceShipmentId: '100' } };
  engine.context.defineProperty('view', { value: view });
  engine.context.defineProperty('flowSettingsEnabled', { value: false });
  engine.registerModels({ RecordProbe });
  const host = engine.createModel({
    use: FlowModel,
    subModels: { editor: { uid: 'shipment-editor', use: 'RecordProbe' } },
  });
  return { engine, view, host };
}

describe('numbered shipment editor context lifecycle', () => {
  it('opens a shipment without adding a cycle or overwriting the workspace view', async () => {
    const { engine, view, host } = setup();
    const onReady = vi.fn();
    const { unmount } = render(<ScopedShipmentEditor host={host} runId="10" shipmentId="101" onReady={onReady} />);
    await waitFor(() => expect(screen.getByTestId('shipment-record').textContent).toBe('101'));
    expect(engine.context.view).toBe(view);
    expect(() => engine.context.getPropertyOptions('missing-context-property')).not.toThrow();
    expect(engine.context.getPropertyOptions('missing-context-property')).toBeUndefined();
    expect(host.context.view).toBe(view);
    const scoped = onReady.mock.calls.find(([value]) => value)?.[0] as FlowEngine;
    expect(scoped.getModel('shipment-editor')).not.toBe(engine.getModel('shipment-editor'));
    unmount();
    expect(engine.nextEngine).toBeUndefined();
    expect(onReady).toHaveBeenLastCalledWith(undefined);
  });

  it('preserves the workspace after switching shipments, closing, and reopening', async () => {
    const { engine, view, host } = setup();
    const onReady = vi.fn();
    for (const id of ['101', '102', '101']) {
      const { unmount } = render(<ScopedShipmentEditor host={host} runId="10" shipmentId={id} onReady={onReady} />);
      await waitFor(() => expect(screen.getByTestId('shipment-record').textContent).toBe(id));
      unmount();
      expect(engine.context.view).toBe(view);
      expect(engine.nextEngine).toBeUndefined();
      expect(() => host.context.getPropertyOptions('missing-context-property')).not.toThrow();
      const workspace =
        engine.getModel('workspace-probe') || engine.createModel({ uid: 'workspace-probe', use: 'RecordProbe' });
      const returned = render(
        <FlowEngineProvider engine={engine}>
          <FlowModelRenderer model={workspace} />
        </FlowEngineProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('shipment-record').textContent).toBe('10:100'));
      returned.unmount();
    }
  });
});
