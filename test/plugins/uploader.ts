import fs from "fs";
import os from "os";
import path from "path";
import {expect} from "vitest";
import Uploader from "../../server/plugins/uploader";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trollroom-uploader-"));

afterAll(() => fs.rmSync(directory, {recursive: true}));

describe("Uploader", function () {
	it("detects uploaded file types", async function () {
		const image = path.join(directory, "image");
		const text = path.join(directory, "text");
		fs.writeFileSync(image, Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"));
		fs.writeFileSync(text, "hello");

		expect(await Uploader.getFileType(image)).to.equal("image/png");
		expect(await Uploader.getFileType(text)).to.equal("text/plain");
	});
});
