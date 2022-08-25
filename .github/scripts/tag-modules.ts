async function getModulePatchVersion(
  moduleName: string[],
  versionPrefix: string,
) {
  const listProcess = Deno.run({
    cmd: ["git", "--no-pager", "tag", "-l", `"${moduleName}*"`],
    stdout: "piped",
  });

  await listProcess.status();
  const allVersions = new TextDecoder().decode(await listProcess.output());

  let patchVersion = 0;

  if (allVersions.length > 0) {
    const currentVersion = allVersions.split("\n").slice(-1)[0];

    if (currentVersion.includes(`${moduleName}-${versionPrefix}`)) {
      const oldPatchVersion = Number.parseInt(
        currentVersion.replace(`${moduleName}-${versionPrefix}.`, ""),
      );
      patchVersion = oldPatchVersion + 1;
    }
  }
  return patchVersion;
}

async function getChangedModules() {
  const rawChangedFiles = await Deno.readTextFile(
    `${Deno.env.get("HOME")}/files.json`,
  );
  const changedFiles: [string] = JSON.parse(rawChangedFiles);

  const modulePaths = changedFiles.filter((path) => {
    return path.includes("modules/");
  }).map((path) => {
    return path.substring(0, path.lastIndexOf("/"));
  });

  const moduleSet = new Set(modulePaths);
  return Array.from(moduleSet);
}

async function setupGitUser() {
  const userProc = Deno.run({
    cmd: ["git", "config", "user.name", `"${Deno.env.get("GITHUB_ACTOR")}"`],
    stdout: "piped",
  });
  const emailProc = Deno.run({
    cmd: [
      "git",
      "config",
      "user.email",
      `"${Deno.env.get("GITHUB_ACTOR")}@users.noreply.github.com"`,
    ],
    stdout: "piped",
  });

  await Promise.all([
    userProc.status(),
    emailProc.status(),
  ]);

  console.log(userProc.output());
  console.log(emailProc.output());
}

async function tagChangedModules() {
  await setupGitUser();

  const changedModules = await getChangedModules();

  console.log(
    `Found the following changed modules: ${changedModules.toString()}`,
  );

  await Promise.all(
    changedModules.map(async (modulePath) => {
      try {
        const moduleName = modulePath.split("/").slice(-1);
        const versionPrefix = await Deno.readTextFile(
          `${modulePath}/version.txt`,
        );

        let patchVersion = await getModulePatchVersion(
          moduleName,
          versionPrefix,
        );

        console.log(
          `For module: "${moduleName}", creating version: "${versionPrefix}.${changedModules.toString()}"`,
        );

        const tagProc = Deno.run({
          cmd: [
            "git",
            "tag",
            `"${moduleName}-${versionPrefix}.${patchVersion}"`,
          ],
          stdout: "piped",
        });
        await tagProc.status();

        console.log(tagProc.output());

        const pushTagProc = Deno.run({
          cmd: [
            "git",
            "push",
            "origin",
            `"${moduleName}-${versionPrefix}.${patchVersion}"`,
          ],
          stdout: "piped",
        });
        await pushTagProc.status();

        console.log(pushTagProc.output());
      } catch (error) {
        console.info(error);
      }
    }),
  );
}

await tagChangedModules();
