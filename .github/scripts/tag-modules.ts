const rawChangedFiles = await Deno.readTextFile(`${Deno.env.get("HOME")}/files.json`);
const changedFiles = JSON.parse(rawChangedFiles);

console.log(changedFiles);
