export function requireMaintenanceWrite(taskName) {
  if (process.env.CYBERPUNK_MAINTENANCE_WRITE === "1") return;
  throw new Error(
    `${taskName} — разовая миграция, которая переписывает авторские данные. ` +
      "Сделайте коммит или резервную копию и повторите с " +
      "CYBERPUNK_MAINTENANCE_WRITE=1.",
  );
}
