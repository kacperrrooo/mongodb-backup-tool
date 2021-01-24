const { writeFile, existsSync } = require("fs");
const mongoose = require("mongoose");
const input = require("input");

const qMarks = (objects) => {
	const l = objects.length;
	const marks = [];
	for (let i = 0; i < l; i++) {
		marks.push("?");
	}

	return marks;
}

input.text("Podaj nazwe pliku do którego ma zostać wgrany backup", { default: "backup" }).then(async file => {
	let serverAddress;

	const ip = await input.text("Podaj ip serwera bazy danych", { default: "127.0.0.1" });
	if (ip.includes(':')) {
		serverAddress = ip;
	} else {
		const port = await input.text("Podaj port bazy danych", { default: "27017" });
		serverAddress = `${ip}:${port}`;
	}
	const database = await input.text("Podaj nazwę bazy danych której chcesz zrobić backup");
	const url = `mongodb://${serverAddress}/${database}`;

	const connection = await mongoose.connect(url, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
		useCreateIndex: true
	});

	const collections = await connection.connection.db.listCollections().toArray();

	if (!existsSync(`./${file}.db`)) writeFile(`./${file}.db`, "", () => { });

	const db = require("better-sqlite3")(`./${file}.db`);

	await new Promise(resolve => {
		collections.forEach(async (c, ci) => {
			const collection = await connection.connection.db.collection(c.name);
			let data = await collection.find({});
			data = await data.toArray();
			await new Promise(r => {
				data.forEach((d, i) => {
					const keys = Object.keys(d).filter(x => x !== "_id" && x !== "__v");
					if (i === 0) {
						const sql = `CREATE TABLE IF NOT EXISTS ${c.name} (${keys.join(",")})`;
						db.prepare(sql).run();
					}

					const objects = [];

					keys.forEach(k => {
						objects.push(d[k]);
					});

					db.prepare(`INSERT INTO ${c.name} (${keys.join(",")}) VALUES(${qMarks(objects).join(",")})`).run(...objects);
					if (i === data.length - 1) r();
				});
			});
			if (ci === collections.length - 1) resolve();
		});
	});
	const close = await input.text("Backup zakończony pomyślnie. Czy chcesz zamknąć program? (Y/N)", { default: "Y" });
	if (close.toLowerCase() === "y") process.exit();
});
