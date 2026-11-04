/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FormGridModel, type DefaultFormGridStructure } from '@nocobase/client';
import { FlowModelRenderer, type FlowModel } from '@nocobase/flow-engine';
import { Tabs } from 'antd';
import React from 'react';

/** Native section grids share one form, so tab changes retain values and one submit validates them all. */
type ShipmentGridStructure = DefaultFormGridStructure & {
  subModels: DefaultFormGridStructure['subModels'] & { sections: FlowModel[] };
};

export class LogisticsWorkspaceShipmentSectionsGridModel extends FormGridModel<ShipmentGridStructure> {
  render() {
    const sections = (this.subModels.sections || []) as FlowModel[];
    return (
      <Tabs
        items={sections.map((section, index) => ({
          key: section.uid,
          label:
            typeof section.props.workspaceSectionTitle === 'string' ? section.props.workspaceSectionTitle : 'Раздел',
          forceRender: section instanceof FormGridModel,
          children: (
            <>
              {index === 0 && this.subModels.items?.length ? super.render() : null}
              <FlowModelRenderer model={section} showFlowSettings={true} />
            </>
          ),
        }))}
      />
    );
  }
}
LogisticsWorkspaceShipmentSectionsGridModel.define({ ...FormGridModel.meta, label: 'Разделы поставки' });
