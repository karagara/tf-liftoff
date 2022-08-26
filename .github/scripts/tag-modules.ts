async function getModulePatchVersion(
  moduleName: string[],
  versionPrefix: string,
) {
  const listProcess = Deno.run({
    cmd: ["git", "--no-pager", "tag", "-l", `*${moduleName}*`],
    stdout: "piped",
  });

  await listProcess.status();
  const allVersions = new TextDecoder().decode(await listProcess.output());
  console.log(
    `all found versions of ${moduleName}: ${allVersions.split("\n")}`,
  );

  let patchVersion = 0;

  if (allVersions.length > 0) {
    const currentVersion = allVersions.trim().split("\n").at(-1);

    console.log(`split list: ${allVersions.split("\n")}`);

    console.log(`current version: ${currentVersion}`);

    if (
      currentVersion &&
      currentVersion.includes(`${moduleName}-${versionPrefix}`)
    ) {
      const patchString = currentVersion
        .replaceAll('"', "")
        .replace(`${moduleName}-${versionPrefix}-`, "")
        .split(".")
        .at(-1);

      patchVersion = patchString ? Number.parseInt(patchString) + 1 : 0;
    }
  }
  return patchVersion;
}

async function getChangedModules() {
  console.log(`${Deno.env.get("HOME")}/code/tf-liftoff/files.json`);
  const rawChangedFiles = await Deno.readTextFile(
    `${Deno.env.get("HOME")}/code/tf-liftoff/files.json`,
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

async function setupGit() {
  const userProc = Deno.run({
    cmd: ["git", "config", "user.name", `"${Deno.env.get("GITHUB_ACTOR")}"`],
  });
  const emailProc = Deno.run({
    cmd: [
      "git",
      "config",
      "user.email",
      `"${Deno.env.get("GITHUB_ACTOR")}@users.noreply.github.com"`,
    ],
  });

  await Promise.all([
    userProc.status(),
    emailProc.status(),
  ]);

  const pullProc = Deno.run({
    cmd: ["git", "fetch", "--tags"],
  });

  await pullProc.status();
}

async function tagChangedModules() {
  await setupGit();

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
          `For module: "${moduleName}", creating version: "${versionPrefix}.${patchVersion}"`,
        );

        const tagProc = Deno.run({
          cmd: [
            "git",
            "tag",
            `${moduleName}-${versionPrefix}.${patchVersion}`,
          ],
          stdout: "piped",
        });
        await tagProc.status();

        console.log(await tagProc.output());

        // const pushTagProc = Deno.run({
        //   cmd: [
        //     "git",
        //     "push",
        //     "origin",
        //     `${moduleName}-${versionPrefix}.${patchVersion}`,
        //   ],
        //   stdout: "piped",
        // });
        // await pushTagProc.status();

        // console.log(await pushTagProc.output());
      } catch (error) {
        console.info(error);
      }
    }),
  );
}

await tagChangedModules();
