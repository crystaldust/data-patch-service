const { Client } = require("pg");

const pgClient = new Client();
pgClient.connect();

pgClient.query(
  `
    create table if not exists data_patches
(
    task_id   varchar,
    state     varchar,
    patch_url varchar
);

alter table data_patches
    owner to airflow;
    `
);

function createTask(taskId) {
  let sql = `insert into data_patches values ($1, $2, $3)`;
  const values = [taskId, "created", ""];
  pgClient.query(sql, values);
}

function updateTaskState(taskId, state) {
  const sql = `update data_patches set state='$1' where task_id = '$2'`;
  const values = [state, taskId];
  pgClient.query(sql, values);
}

function updateTaskUrl(taskId, taskUrl) {
  const sql = `update data_patches set patch_url='$1' where task_id = '$2'`;
  const values = [taskUrl, taskId];
  pgClient.query(sql, values);
}
