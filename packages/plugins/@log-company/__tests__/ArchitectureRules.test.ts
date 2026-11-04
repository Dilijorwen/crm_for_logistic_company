import { describe, expect, it } from 'vitest';
import { boundaryViolation, importsOf } from './architecture/imports';

const root = '/project/plugin-example/src/';

describe('architecture rule regression', () => {
  it('reads static, type-only, dynamic, CommonJS and re-export imports without matching comments', () => {
    expect(
      importsOf(`
      // import ignored from 'comment';
      const text = "import ignored from 'string'";
      import type { Value } from './types';
      export { value } from './public';
      import './side-effect';
      const dynamic = import('./lazy');
      const common = require('./common');
      import old = require('./legacy');
      type Value = import('./type-query').Value;
    `),
    ).toEqual(['./types', './public', './side-effect', './lazy', './common', './legacy', './type-query']);
  });

  it.each([
    ['client/features/edit/ui/Form.tsx', 'client/widgets/table/index.ts', '../table'],
    ['client/features/edit/model.ts', 'client/features/delete/index.ts', '../delete'],
    ['client/widgets/table/ui/Table.tsx', 'client/entities/order/model/types.ts', '../types'],
    ['client/shared/lib/index.ts', 'server/domain/order.ts', '../server'],
    ['server/application/Create.ts', 'client/entities/order/index.ts', '../client'],
    ['server/domain/Order.ts', 'server/collections/orders.ts', '../collections'],
    ['server/application/Create.ts', 'server/infrastructure/Repository.ts', '../repository'],
    ['server/application/Create.ts', 'sequelize', 'sequelize'],
    ['server/domain/Order.ts', 'react', 'react'],
    ['shared/contracts.ts', 'server/application/Create.ts', '../server'],
    ['client-v2/widgets/table/index.ts', '@nocobase/client', '@nocobase/client'],
  ])('rejects forbidden dependency from %s to %s', (from, to, dependency) => {
    expect(
      boundaryViolation(root + from, to.includes('/') && !to.startsWith('@') ? root + to : to, dependency),
    ).toBeTruthy();
  });

  it.each([
    ['client/app/plugin.ts', 'client/widgets/table/index.ts'],
    ['client/widgets/table/ui/Table.tsx', 'client/entities/order/index.ts'],
    ['client/entities/order/model/order.ts', 'client/entities/order/api/orders.ts'],
    ['server/application/Create.ts', 'server/domain/Order.ts'],
    ['server/domain/Order.ts', 'shared/contracts.ts'],
    ['server/interfaces/http/Controller.ts', 'server/application/Create.ts'],
  ])('allows dependency from %s to %s', (from, to) => {
    expect(boundaryViolation(root + from, root + to, './dependency')).toBeUndefined();
  });
});
