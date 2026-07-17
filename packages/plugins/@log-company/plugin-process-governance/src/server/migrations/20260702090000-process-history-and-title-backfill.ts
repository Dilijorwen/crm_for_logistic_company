import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    const processHistory = this.db.getCollection('process_history');
    if (processHistory) {
      await processHistory.sync({
        alter: {
          drop: false,
        },
      });
    }

    await this.db.sequelize.query(`
      UPDATE customs_processes AS cp
      SET title = concat(
        coalesce(nullif(btrim(cp_source.car_number), ''), 'Без номера'),
        ' с ',
        coalesce(nullif(btrim(cc.name), ''), 'Без клиента')
      )
      FROM customs_processes AS cp_source
      LEFT JOIN chinese_clients AS cc ON cc.id = cp_source.chinese_client_id
      WHERE cp.id = cp_source.id
        AND cp.title IS DISTINCT FROM concat(
          coalesce(nullif(btrim(cp_source.car_number), ''), 'Без номера'),
          ' с ',
          coalesce(nullif(btrim(cc.name), ''), 'Без клиента')
        )
    `);
  }

  async down() {
    // Do not drop process_history or rewrite process titles automatically.
  }
}
