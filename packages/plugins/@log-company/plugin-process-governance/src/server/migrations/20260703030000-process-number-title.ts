import { Migration } from '@nocobase/server';

const FIELD_OPTIONS = {
  uiSchema: {
    type: 'number',
    title: 'Порядковый номер',
    'x-component': 'InputNumber',
    'x-read-pretty': true,
  },
};

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    await this.db.sequelize.query(`
      ALTER TABLE customs_processes
      ADD COLUMN IF NOT EXISTS process_number integer
    `);

    await this.db.sequelize.query(`
      WITH numbered AS (
        SELECT
          id,
          row_number() OVER (ORDER BY "createdAt" ASC NULLS LAST, id ASC)::integer AS rn
        FROM customs_processes
      )
      UPDATE customs_processes AS cp
      SET process_number = numbered.rn
      FROM numbered
      WHERE cp.id = numbered.id
        AND cp.process_number IS NULL
    `);

    await this.db.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS customs_processes_process_number_seq
    `);

    await this.db.sequelize.query(`
      SELECT setval(
        'customs_processes_process_number_seq',
        greatest(coalesce((SELECT max(process_number) FROM customs_processes), 0), 1),
        true
      )
    `);

    await this.db.sequelize.query(`
      ALTER TABLE customs_processes
      ALTER COLUMN process_number SET DEFAULT nextval('customs_processes_process_number_seq')
    `);

    await this.db.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS customs_processes_process_number_unique
      ON customs_processes(process_number)
      WHERE process_number IS NOT NULL
    `);

    await this.db.sequelize.query(
      `
        INSERT INTO fields (key, name, type, interface, "collectionName", options, sort)
        VALUES (
          'process_number',
          'process_number',
          'integer',
          'integer',
          'customs_processes',
          CAST(:options AS json),
          54
        )
        ON CONFLICT ("collectionName", name)
        DO UPDATE SET
          type = excluded.type,
          interface = excluded.interface,
          options = excluded.options
      `,
      {
        replacements: {
          options: JSON.stringify(FIELD_OPTIONS),
        },
      },
    );

    await this.db.sequelize.query(`
      UPDATE customs_processes AS cp
      SET title = concat(
        coalesce(cp.process_number::text, 'Без номера процесса'),
        ' - ',
        coalesce(nullif(btrim(cp.car_number), ''), 'Без номера'),
        ' с ',
        coalesce(nullif(btrim(cc.name), ''), 'Без клиента')
      )
      FROM chinese_clients AS cc
      WHERE cc.id = cp.chinese_client_id
        AND cp.title IS DISTINCT FROM concat(
          coalesce(cp.process_number::text, 'Без номера процесса'),
          ' - ',
          coalesce(nullif(btrim(cp.car_number), ''), 'Без номера'),
          ' с ',
          coalesce(nullif(btrim(cc.name), ''), 'Без клиента')
        )
    `);

    await this.db.sequelize.query(`
      UPDATE customs_processes AS cp
      SET title = concat(
        coalesce(cp.process_number::text, 'Без номера процесса'),
        ' - ',
        coalesce(nullif(btrim(cp.car_number), ''), 'Без номера'),
        ' с ',
        'Без клиента'
      )
      WHERE cp.chinese_client_id IS NULL
        AND cp.title IS DISTINCT FROM concat(
          coalesce(cp.process_number::text, 'Без номера процесса'),
          ' - ',
          coalesce(nullif(btrim(cp.car_number), ''), 'Без номера'),
          ' с ',
          'Без клиента'
        )
    `);
  }

  async down() {
    // Keep process_number and generated titles.
  }
}
