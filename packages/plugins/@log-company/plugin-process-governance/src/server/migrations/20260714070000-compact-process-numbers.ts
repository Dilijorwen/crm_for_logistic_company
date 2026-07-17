import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    await this.db.sequelize.query(`
      ALTER TABLE customs_processes
      ADD COLUMN IF NOT EXISTS process_number integer
    `);

    await this.db.sequelize.query(`
      ALTER TABLE customs_processes
      ALTER COLUMN process_number DROP DEFAULT
    `);

    await this.db.sequelize.query(`
      DROP INDEX IF EXISTS customs_processes_process_number_unique
    `);

    await this.db.sequelize.query(`
      WITH numbered AS (
        SELECT
          cp.id,
          row_number() OVER (ORDER BY cp."createdAt" ASC NULLS LAST, cp.id ASC)::integer AS process_number,
          coalesce(nullif(btrim(cp.car_number), ''), 'Без номера') AS car_number,
          coalesce(nullif(btrim(cc.name), ''), 'Без клиента') AS client_name
        FROM customs_processes AS cp
        LEFT JOIN chinese_clients AS cc ON cc.id = cp.chinese_client_id
      ),
      desired AS (
        SELECT
          id,
          process_number,
          concat(process_number::text, ' - ', car_number, ' с ', client_name) AS title
        FROM numbered
      )
      UPDATE customs_processes AS cp
      SET
        process_number = desired.process_number,
        title = desired.title
      FROM desired
      WHERE cp.id = desired.id
        AND (
          cp.process_number IS DISTINCT FROM desired.process_number
          OR cp.title IS DISTINCT FROM desired.title
        )
    `);
  }

  async down() {
    // Keep compact process numbers and generated titles.
  }
}
