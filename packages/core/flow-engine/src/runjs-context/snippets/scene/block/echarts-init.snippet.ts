/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { JSBlockRunJSContext } from '../../../contexts/JSBlockRunJSContext';
import { SnippetModule } from '../../types';

const snippet: SnippetModule = {
  contexts: [JSBlockRunJSContext],
  prefix: 'sn-echarts',
  label: 'Init ECharts',
  description: 'Load ECharts and render a simple chart inside the block',
  locales: {},
  content: `
const container = document.createElement('div');
container.style.height = '400px';
container.style.width = '100%';
ctx.render(container);
const echarts = await ctx.requireAsync('echarts@5/dist/echarts.min.js');
if (!echarts) {
  throw new Error('ECharts library not loaded');
}

const chart = echarts.init(container);
chart.setOption({
  title: { text: ctx.t('ECharts') },
  series: [{ type: 'pie', data: [{ value: 1, name: ctx.t('A') }] }],
});

chart.resize();
`,
};

export default snippet;
