const CONNECTION_FIELDS = new Set(["title", "text", "personId", "locationId"]);

function cleanId(value) {
  return String(value ?? "").trim();
}

function nextUniqueId(makeId, used) {
  let candidate = "";
  do candidate = cleanId(makeId?.());
  while (!candidate || used.has(candidate));
  used.add(candidate);
  return candidate;
}

export function normalizeClueConnections(raw, makeId = () => crypto.randomUUID()) {
  const used = new Set();
  const result = [];
  for (const value of Array.isArray(raw) ? raw : []) {
    if (!value || typeof value !== "object") continue;
    let id = cleanId(value.id);
    if (!id || used.has(id)) id = nextUniqueId(makeId, used);
    else used.add(id);
    result.push({
      id,
      title: String(value.title ?? "").trim(),
      text: String(value.text ?? ""),
      personId: cleanId(value.personId),
      locationId: cleanId(value.locationId),
    });
  }
  return result;
}

export function createClueConnection(makeId = () => crypto.randomUUID()) {
  return {
    id: cleanId(makeId()),
    title: "",
    text: "",
    personId: "",
    locationId: "",
  };
}

export function updateClueConnection(connections, id, field, value) {
  if (!CONNECTION_FIELDS.has(field) || !Array.isArray(connections)) return false;
  const connection = connections.find((item) => item?.id === id);
  if (!connection) return false;
  connection[field] = field === "title" ? String(value ?? "") : String(value ?? "");
  return true;
}

export function removeClueConnection(connections, id) {
  if (!Array.isArray(connections)) return false;
  const index = connections.findIndex((item) => item?.id === id);
  if (index < 0) return false;
  connections.splice(index, 1);
  return true;
}
