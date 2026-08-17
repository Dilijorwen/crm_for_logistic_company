/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { SnippetModule } from '../../types';
import { JSBlockRunJSContext } from '../../../contexts/JSBlockRunJSContext';

const snippet: SnippetModule = {
  contexts: [JSBlockRunJSContext],
  prefix: 'sn-react-jsx',
  label: 'Render React (JSX)',
  description: 'Render a simple React component using JSX syntax',
  locales: {},
  content: `
// Render a React component with JSX
const { React } = ctx.libs;

const App = () => (
  <div style={{ padding: 12 }}>
    <h3 style={{ margin: 0, color: '#1890ff' }}>Hello JSX</h3>
    <div style={{ color: '#555' }}>This block is rendered by JSX.</div>
  </div>
);

ctx.render(<App />);
`,
};

export default snippet;
