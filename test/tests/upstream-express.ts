import {readFileSync} from "fs";
import {spawnSync} from "child_process";
import path from "path";

const workflow = readFileSync(
	path.resolve(__dirname, "../../.github/workflows/watch-upstream-express.yml"),
	"utf8"
);
const predicate = workflow
	.split("\n")
	.find((line) => line.trim().startsWith('[[ "$version"'))!
	.trim()
	.split(" || exit 0")[0];

describe("upstream Express watcher", () => {
	for (const version of ["5.0.0", "^5.1.0", "~5.1.0", "4.20.0", "^4.22.2", "~4.22.2"]) {
		it(`checks ${version}`, () => {
			const result = spawnSync("bash", ["-c", predicate], {
				env: {...process.env, version},
			});
			expect(result.status).toBe(version.includes("5.") ? 0 : 1);
		});
	}
});
