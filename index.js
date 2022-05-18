#!/usr/bin/env node

const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { Select } = require("enquirer");
const execFileP = promisify(execFile);
const spawnP = promisify(spawn);
const { red, cyan } = require("ansi-colors");

function formatName(image, color = false) {
  let repo = red(
    image.Repository === "<none>" ? image.ID : image.Repository || ""
  );
  let tag = image.Tag || "";
  if (tag.length >= 40) {
    tag = tag.substr(0, 37) + "...";
  }
  if (color) {
    repo = red(repo);
    tag = cyan(tag);
  }
  return `${repo}:${tag}`;
}

function formatImage(image, nameLength) {
  const sizePadded = `${image.Size || ""}`.padStart(10);
  const datePadded = `${image.CreatedSince || ""}`.padStart(15);
  const namePadded = formatName(image, true).padEnd(nameLength, " ");
  return `${namePadded} ${sizePadded} ${datePadded}`;
}

async function getDockerJSONLines(args) {
  const { stdout } = await execFileP("docker", args, { shell: true });
  return stdout
    .split("\n")
    .filter((s) => s)
    .map((s) => JSON.parse(s));
}

class SelectWithoutDump extends Select {
  format() {
    return `${this.selected.length} images`;
  }
}

async function promptImageIds() {
  const images = await getDockerJSONLines([
    "images",
    "--format='{{json .}}'",
    "--no-trunc",
  ]);
  const nameLength = Math.max(...images.map((i) => formatName(i, true).length));
  const prompt = new SelectWithoutDump({
    name: "images",
    multiple: true,
    message: "Choose images to `rmi`:",
    choices: images.map((i) => ({
      name: formatImage(i, nameLength),
      value: i.ID,
    })),
    result(names) {
      return Object.values(this.map(names));
    },
  });

  try {
    return await prompt.run();
  } catch (err) {
    return [];
  }
}

async function main() {
  const imageIds = await promptImageIds();
  if (!imageIds.length) {
    return;
  }
  await spawnP("docker", ["rmi", "-f", ...imageIds], {
    shell: true,
    stdio: "inherit",
  });
}

main();
