const actorOperationQueues = new Map();

function actorKey(actor) {
  return actor?.uuid ?? actor?.id ?? null;
}

export function enqueueActorOperation(actor, operation) {
  const key = actorKey(actor);
  if (!key) return Promise.resolve().then(operation);

  const previous = actorOperationQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  actorOperationQueues.set(key, next);
  return next.finally(() => {
    if (actorOperationQueues.get(key) === next) {
      actorOperationQueues.delete(key);
    }
  });
}

export function clearActorOperationQueues() {
  actorOperationQueues.clear();
}
