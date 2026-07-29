import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { organizeIconLibrary } from "../scripts/lib/icon-library.mjs";

async function fixture(t, itemImages) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "cyberpunk-remaster-icons-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const iconRoot = path.join(root, "assets", "icons");
  await Promise.all([
    fs.mkdir(iconRoot, { recursive: true }),
    fs.mkdir(path.join(root, "data"), { recursive: true }),
    fs.mkdir(path.join(root, "content", "exports"), { recursive: true }),
  ]);
  const items = itemImages.map((img, index) => ({
    _id: `item-${index}`,
    name: `Предмет ${index}`,
    type: "equipment",
    folder: "pkt-folder",
    img: `modules/cyberpunk-remaster/assets/icons/${img}`,
    system: { subitems: [] },
  }));
  await Promise.all([
    fs.writeFile(
      path.join(root, "content", "exports", "items.json"),
      JSON.stringify(items),
    ),
    fs.writeFile(
      path.join(root, "data", "item-folders.json"),
      JSON.stringify([
        {
          _id: "pkt-folder",
          name: "ПКТ",
          folder: null,
        },
      ]),
    ),
    fs.writeFile(path.join(root, "content", "exports", "macros.json"), "[]"),
  ]);
  return { root, iconRoot };
}

test("icon organizer moves PKT to implants without renaming files", async (t) => {
  const { root, iconRoot } = await fixture(t, ["pkt/File.png"]);
  await fs.mkdir(path.join(iconRoot, "pkt"), { recursive: true });
  await fs.writeFile(path.join(iconRoot, "pkt", "File.png"), "original");

  await organizeIconLibrary({
    root,
    sourceModuleRoot: path.join(root, "source-module"),
  });

  const [item] = JSON.parse(
    await fs.readFile(
      path.join(root, "content", "exports", "items.json"),
      "utf8",
    ),
  );
  assert.equal(
    item.img,
    "modules/cyberpunk-remaster/assets/icons/implants/File.png",
  );
  assert.equal(
    await fs.readFile(path.join(iconRoot, "implants", "File.png"), "utf8"),
    "original",
  );
  assert.equal(
    await fs
      .access(path.join(iconRoot, "pkt", "File.png"))
      .then(() => true)
      .catch(() => false),
    false,
  );
});

test("icon organizer rejects same filename with different contents", async (t) => {
  const { root, iconRoot } = await fixture(t, [
    "old-a/Same.svg",
    "old-b/Same.svg",
  ]);
  await Promise.all([
    fs.mkdir(path.join(iconRoot, "old-a"), { recursive: true }),
    fs.mkdir(path.join(iconRoot, "old-b"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(iconRoot, "old-a", "Same.svg"), "first"),
    fs.writeFile(path.join(iconRoot, "old-b", "Same.svg"), "second"),
  ]);

  await assert.rejects(
    organizeIconLibrary({
      root,
      sourceModuleRoot: path.join(root, "source-module"),
    }),
    /Different icons would overwrite implants\/Same\.svg/,
  );
});

test("icon organizer preserves core and system icon paths", async (t) => {
  const { root, iconRoot } = await fixture(t, ["unused/File.png"]);
  const items = [
    {
      _id: "system-action",
      name: "Системное действие",
      type: "action",
      folder: "pkt-folder",
      img: "systems/sf2e/icons/actions/OneAction.webp",
      system: { subitems: [] },
    },
    {
      _id: "core-placeholder",
      name: "Системная заглушка",
      type: "equipment",
      folder: "pkt-folder",
      img: "icons/svg/item-bag.svg",
      system: { subitems: [] },
    },
  ];
  await fs.writeFile(
    path.join(root, "content", "exports", "items.json"),
    JSON.stringify(items),
  );

  const result = await organizeIconLibrary({
    root,
    sourceModuleRoot: path.join(root, "source-module"),
  });
  const restored = JSON.parse(
    await fs.readFile(
      path.join(root, "content", "exports", "items.json"),
      "utf8",
    ),
  );

  assert.equal(restored[0].img, "systems/sf2e/icons/actions/OneAction.webp");
  assert.equal(restored[1].img, "icons/svg/item-bag.svg");
  assert.equal(result.documents, 0);
  assert.deepEqual(await fs.readdir(iconRoot), []);
});

test("icon organizer imports the user Data assets icon library", async (t) => {
  const { root, iconRoot } = await fixture(t, ["unused/File.png"]);
  const dataRoot = path.join(root, "foundry-data");
  const source = path.join(dataRoot, "assets", "icons", "UserIcon.png");
  await fs.mkdir(path.dirname(source), { recursive: true });
  await fs.writeFile(source, "user-authored");
  await fs.writeFile(
    path.join(root, "content", "exports", "items.json"),
    JSON.stringify([
      {
        _id: "user-icon",
        name: "Пользовательская иконка",
        type: "equipment",
        folder: "pkt-folder",
        img: "assets/icons/UserIcon.png",
        system: { subitems: [] },
      },
    ]),
  );

  await organizeIconLibrary({
    root,
    sourceModuleRoot: path.join(dataRoot, "modules", "cyberpunk-remaster"),
    foundryDataRoot: dataRoot,
  });
  const [item] = JSON.parse(
    await fs.readFile(
      path.join(root, "content", "exports", "items.json"),
      "utf8",
    ),
  );

  assert.equal(
    item.img,
    "modules/cyberpunk-remaster/assets/icons/implants/UserIcon.png",
  );
  assert.equal(
    await fs.readFile(path.join(iconRoot, "implants", "UserIcon.png"), "utf8"),
    "user-authored",
  );
});
