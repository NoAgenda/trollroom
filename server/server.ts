import _ from "lodash";
import {Server as wsServer} from "ws";
import express, {NextFunction, Request, Response} from "express";
import fs from "fs";
import path from "path";
import {Server as ioServer, Socket as ioSocket} from "socket.io";
import dns from "dns";
import colors from "chalk";
import net from "net";

import log from "./log";
import Client from "./client";
import ClientManager from "./clientManager";
import Uploader from "./plugins/uploader";
import Helper from "./helper";
import Config, {ConfigType} from "./config";
import Identification from "./identification";
import changelog from "./plugins/changelog";
import inputs from "./plugins/inputs";
import Auth from "./plugins/auth";

import themes from "./plugins/packages/themes";
themes.loadLocalThemes();

import packages from "./plugins/packages/index";
import {NetworkWithIrcFramework} from "./models/network";
import Utils from "./command-line/utils";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
	AuthPerformData,
} from "../shared/types/socket-events";
import {ChanType} from "../shared/types/chan";
import {
	LockedSharedConfiguration,
	SharedConfiguration,
	ConfigNetDefaults,
	LockedConfigNetDefaults,
} from "../shared/types/config";

type ServerOptions = {
	dev: boolean;
};

type ServerConfiguration = ConfigType & {
	stylesheets: string[];
};

type IndexTemplateConfiguration = ServerConfiguration & {
	cacheBust: string;
};

type Socket = ioSocket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type Server = ioServer<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>;

// A random number that will force clients to reload the page if it differs
const serverHash = Math.floor(Date.now() * Math.random());

let manager: ClientManager | null = null;

export default async function (
	options: ServerOptions = {
		dev: false,
	}
) {
	log.info(`The Lounge ${colors.green(Helper.getVersion())} \
(Node.js ${colors.green(process.versions.node)} on ${colors.green(process.platform)} ${
		process.arch
	})`);
	log.info(`Configuration file: ${colors.green(Config.getConfigPath())}`);

	const staticOptions = {
		redirect: false,
		maxAge: 86400 * 1000,
	};

	const app = express();

	if (options.dev) {
		(await import("./plugins/dev-server")).default(app);
	}

	app.set("env", "production")
		.disable("x-powered-by")
		.use(allRequests)
		.use(addSecurityHeaders)
		.get("/", indexRequest)
		.get("/service-worker.js", forceNoCacheRequest)
		.get("/js/bundle.js.map", forceNoCacheRequest)
		.get("/css/style.css.map", forceNoCacheRequest)
		.use(express.static(Utils.getFileFromRelativeToRoot("public"), staticOptions))
		.use("/storage/", express.static(Config.getStoragePath(), staticOptions));

	if (Config.values.fileUpload.enable) {
		Uploader.router(app);
	}

	// This route serves *installed themes only*. Local themes are served directly
	// from the `public/themes/` folder as static assets, without entering this
	// handler. Remember this if you make changes to this function, serving of
	// local themes will not get those changes.
	app.get("/themes/:theme.css", (req, res) => {
		const themeName = encodeURIComponent(req.params.theme);
		const theme = themes.getByName(themeName);

		if (theme === undefined || theme.filename === undefined) {
			return res.status(404).send("Not found");
		}

		return res.sendFile(theme.filename);
	});

	app.get("/packages/:package/:filename", (req, res) => {
		const packageName = req.params.package;
		const fileName = req.params.filename;
		const packageFile = packages.getPackage(packageName);

		if (!packageFile || !packages.getFiles().includes(`${packageName}/${fileName}`)) {
			return res.status(404).send("Not found");
		}

		const packagePath = Config.getPackageModulePath(packageName);
		return res.sendFile(path.join(packagePath, fileName));
	});

	if (Config.values.public && (Config.values.ldap || {}).enable) {
		log.warn(
			"Server is public and set to use LDAP. Set to private mode if trying to use LDAP authentication."
		);
	}

	let server: import("http").Server | import("https").Server;

	if (!Config.values.https.enable) {
		const createServer = (await import("http")).createServer;
		server = createServer(app);
	} else {
		const keyPath = Helper.expandHome(Config.values.https.key);
		const certPath = Helper.expandHome(Config.values.https.certificate);
		const caPath = Helper.expandHome(Config.values.https.ca);

		if (!keyPath.length || !fs.existsSync(keyPath)) {
			log.error("Path to SSL key is invalid. Stopping server...");
			process.exit(1);
		}

		if (!certPath.length || !fs.existsSync(certPath)) {
			log.error("Path to SSL certificate is invalid. Stopping server...");
			process.exit(1);
		}

		if (caPath.length && !fs.existsSync(caPath)) {
			log.error("Path to SSL ca bundle is invalid. Stopping server...");
			process.exit(1);
		}

		const createServer = (await import("https")).createServer;
		server = createServer(
			{
				key: fs.readFileSync(keyPath),
				cert: fs.readFileSync(certPath),
				ca: caPath ? fs.readFileSync(caPath) : undefined,
			},
			app
		);
	}

	let listenParams:
		| string
		| {
				port: number;
				host: string | undefined;
		  };

	if (typeof Config.values.host === "string" && Config.values.host.startsWith("unix:")) {
		listenParams = Config.values.host.replace(/^unix:/, "");
	} else {
		listenParams = {
			port: Config.values.port,
			host: Config.values.host,
		};
	}

	// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
	server.on("error", (err) => log.error(`${err}`));

	server.listen(listenParams, () => {
		if (typeof listenParams === "string") {
			log.info("Available on socket " + colors.green(listenParams));
		} else {
			const protocol = Config.values.https.enable ? "https" : "http";
			const address = server?.address();

			if (address && typeof address !== "string") {
				// TODO: Node may revert the Node 18 family string --> number change
				// @ts-expect-error This condition will always return 'false' since the types 'string' and 'number' have no overlap.
				if (address.family === "IPv6" || address.family === 6) {
					address.address = "[" + address.address + "]";
				}

				log.info(
					"Available at " +
						colors.green(`${protocol}://${address.address}:${address.port}/`) +
						` in ${colors.bold(Config.values.public ? "public" : "private")} mode`
				);
			}
		}

		// This should never happen
		if (!server) {
			return;
		}

		const sockets: Server = new ioServer(server, {
			wsEngine: wsServer,
			cookie: false,
			serveClient: false,

			// TODO: type as Server.Transport[]
			transports: Config.values.transports as any,
			pingTimeout: 60000,
		});

		sockets.on("connect", (socket) => {
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			socket.on("error", (err) => log.error(`io socket error: ${err}`));

			if (Config.values.public) {
				performAuthentication.call(socket, {});
			} else {
				socket.on("auth:perform", performAuthentication);
				socket.emit("auth:start", serverHash);
			}
		});

		manager = new ClientManager();
		packages.loadPackages();

		const defaultTheme = themes.getByName(Config.values.theme);

		if (defaultTheme === undefined) {
			log.warn(
				`The specified default theme "${colors.red(
					Config.values.theme
				)}" does not exist, verify your config.`
			);
			Config.values.theme = "default";
		} else if (defaultTheme.themeColor) {
			Config.values.themeColor = defaultTheme.themeColor;
		}

		new Identification((identHandler, err) => {
			if (err) {
				log.error(`Could not start identd server, ${err.message}`);
				process.exit(1);
			} else if (!manager) {
				log.error("Could not start identd server, ClientManager is undefined");
				process.exit(1);
			}

			manager.init(identHandler, sockets);
		});

		// Handle ctrl+c and kill gracefully
		let suicideTimeout: NodeJS.Timeout | null = null;

		const exitGracefully = async function () {
			if (suicideTimeout !== null) {
				return;
			}

			log.info("Exiting...");

			// Close all client and IRC connections
			if (manager) {
				manager.clients.forEach((client) => client.quit());
			}

			if (Config.values.prefetchStorage) {
				log.info("Clearing prefetch storage folder, this might take a while...");

				(await import("./plugins/storage")).default.emptyDir();
			}

			// Forcefully exit after 3 seconds
			suicideTimeout = setTimeout(() => process.exit(1), 3000);

			// Close http server
			server?.close(() => {
				if (suicideTimeout !== null) {
					clearTimeout(suicideTimeout);
				}

				process.exit(0);
			});
		};

		/* eslint-disable @typescript-eslint/no-misused-promises */
		process.on("SIGINT", exitGracefully);
		process.on("SIGTERM", exitGracefully);
		/* eslint-enable @typescript-eslint/no-misused-promises */

		// Clear storage folder after server starts successfully
		if (Config.values.prefetchStorage) {
			import("./plugins/storage")
				.then(({default: storage}) => {
					storage.emptyDir();
				})
				.catch((err: Error) => {
					log.error(`Could not clear storage folder, ${err.message}`);
				});
		}

		changelog.checkForUpdates(manager);
	});

	return server;
}

function getClientLanguage(socket: Socket): string | undefined {
	const acceptLanguage = socket.handshake.headers["accept-language"];

	if (typeof acceptLanguage === "string" && /^[\x00-\x7F]{1,50}$/.test(acceptLanguage)) {
		// only allow ASCII strings between 1-50 characters in length
		return acceptLanguage;
	}

	return undefined;
}

function getClientIp(socket: Socket): string {
	let ip = socket.handshake.address || "127.0.0.1";

	if (Config.values.reverseProxy) {
		const forwarded = String(socket.handshake.headers["x-forwarded-for"])
			.split(/\s*,\s*/)
			.filter(Boolean);

		if (forwarded.length && net.isIP(forwarded[0])) {
			ip = forwarded[0];
		}
	}

	return ip.replace(/^::ffff:/, "");
}

function getClientSecure(socket: Socket) {
	let secure = socket.handshake.secure;

	if (Config.values.reverseProxy && socket.handshake.headers["x-forwarded-proto"] === "https") {
		secure = true;
	}

	return secure;
}

function allRequests(_req: Request, res: Response, next: NextFunction) {
	res.setHeader("X-Content-Type-Options", "nosniff");
	return next();
}

function addSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
	const policies = [
		"default-src 'none'", // default to nothing
		"base-uri 'none'", // disallow <base>, has no fallback to default-src
		"form-action 'self'", // 'self' to fix saving passwords in Firefox, even though login is handled in javascript
		"connect-src 'self' ws: wss: https://listen.noagendastream.com", // allow self for polling; websockets
		"style-src 'self' https: 'unsafe-inline'", // allow inline due to use in irc hex colors
		"script-src 'self'", // javascript
		"worker-src 'self'", // service worker
		"manifest-src 'self'", // manifest.json
		"font-src 'self' https:", // allow loading fonts from secure sites (e.g. google fonts)
		"media-src 'self' https:", // self for notification sound; allow https media (audio previews)
	];

	// If prefetch is enabled, but storage is not, we have to allow mixed content
	// - https://user-images.githubusercontent.com is where we currently push our changelog screenshots
	// - data: is required for the HTML5 video player
	if (Config.values.prefetchStorage || !Config.values.prefetch) {
		policies.push("img-src 'self' data: https://user-images.githubusercontent.com");
		policies.unshift("block-all-mixed-content");
	} else {
		policies.push("img-src http: https: data:");
	}

	res.setHeader("Content-Security-Policy", policies.join("; "));
	res.setHeader("Referrer-Policy", "no-referrer");

	return next();
}

function forceNoCacheRequest(_req: Request, res: Response, next: NextFunction) {
	// Intermittent proxies must not cache the following requests,
	// browsers must fetch the latest version of these files (service worker, source maps)
	res.setHeader("Cache-Control", "no-cache, no-transform");
	return next();
}

function indexRequest(_req: Request, res: Response) {
	res.setHeader("Content-Type", "text/html");

	fs.readFile(Utils.getFileFromRelativeToRoot("client/index.html.tpl"), "utf-8", (err, file) => {
		if (err) {
			log.error(`failed to server index request: ${err.name}, ${err.message}`);
			res.sendStatus(500);
			return;
		}

		const config: IndexTemplateConfiguration = {
			...getServerConfiguration(),
			...{cacheBust: Helper.getVersionCacheBust()},
		};

		res.send(_.template(file)(config));
	});
}

function initializeClient(
	socket: Socket,
	client: Client,
	token: string,
	lastMessage: number,
	openChannel: number
) {
	socket.off("auth:perform", performAuthentication);
	socket.emit("auth:success");

	client.clientAttach(socket.id, token);

	// Client sends currently active channel on reconnect,
	// pass it into `open` directly so it is verified and updated if necessary
	if (openChannel) {
		client.open(socket.id, openChannel);

		// If client provided channel passes checks, use it. if client has invalid
		// channel open (or windows like settings) then use last known server active channel
		openChannel = client.attachedClients[socket.id].openChannel || client.lastActiveChannel;
	} else {
		openChannel = client.lastActiveChannel;
	}

	if (Config.values.fileUpload.enable) {
		new Uploader(socket);
	}

	socket.on("disconnect", function () {
		process.nextTick(() => client.clientDetach(socket.id));
	});

	socket.on("input", (data) => {
		if (_.isPlainObject(data)) {
			client.input(data);
		}
	});

	socket.on("more", (data) => {
		if (_.isPlainObject(data)) {
			const history = client.more(data);

			if (history !== null) {
				socket.emit("more", history);
			}
		}
	});

	socket.on("network:new", (data) => {
		if (_.isPlainObject(data)) {
			// prevent people from overriding webirc settings
			data.uuid = null;
			data.commands = null;
			data.ignoreList = null;

			client.connectToNetwork(data);
		}
	});

	socket.on("network:get", (data) => {
		if (typeof data !== "string") {
			return;
		}

		const network = _.find(client.networks, {uuid: data});

		if (!network) {
			return;
		}

		socket.emit("network:info", network.exportForEdit());
	});

	socket.on("network:edit", (data) => {
		if (!_.isPlainObject(data)) {
			return;
		}

		const network = _.find(client.networks, {uuid: data.uuid});

		if (!network) {
			return;
		}

		(network as NetworkWithIrcFramework).edit(client, data);
	});

	socket.on("history:clear", (data) => {
		if (_.isPlainObject(data)) {
			client.clearHistory(data);
		}
	});

	if (!Config.values.public && !Config.values.ldap.enable) {
		socket.on("change-password", (data) => {
			if (_.isPlainObject(data)) {
				const old = data.old_password;
				const p1 = data.new_password;
				const p2 = data.verify_password;

				if (typeof p1 === "undefined" || p1 === "" || p1 !== p2) {
					socket.emit("change-password", {
						error: "",
						success: false,
					});
					return;
				}

				Helper.password
					.compare(old || "", client.config.password)
					.then((matching) => {
						if (!matching) {
							socket.emit("change-password", {
								error: "password_incorrect",
								success: false,
							});
							return;
						}

						const hash = Helper.password.hash(p1);

						client.setPassword(hash, (success: boolean) => {
							socket.emit("change-password", {
								success: success,
								error: success ? undefined : "update_failed",
							});
						});
					})
					.catch((error: Error) => {
						log.error(`Error while checking users password. Error: ${error.message}`);
					});
			}
		});
	}

	socket.on("open", (data) => {
		client.open(socket.id, data);
	});

	socket.on("sort:networks", (data) => {
		if (!_.isPlainObject(data)) {
			return;
		}

		if (!Array.isArray(data.order)) {
			return;
		}

		client.sortNetworks(data.order);
	});

	socket.on("sort:channels", (data) => {
		if (!_.isPlainObject(data)) {
			return;
		}

		if (!Array.isArray(data.order) || typeof data.network !== "string") {
			return;
		}

		client.sortChannels(data.network, data.order);
	});

	socket.on("names", (data) => {
		if (_.isPlainObject(data)) {
			client.names(data);
		}
	});

	socket.on("changelog", () => {
		Promise.all([changelog.fetch(), packages.outdated()])
			.then(([changelogData, packageUpdate]) => {
				changelogData.packages = packageUpdate;
				socket.emit("changelog", changelogData);
			})
			.catch((error: Error) => {
				log.error(`Error while fetching changelog. Error: ${error.message}`);
			});
	});

	// In public mode only one client can be connected,
	// so there's no need to handle msg:preview:toggle
	if (!Config.values.public) {
		socket.on("msg:preview:toggle", (data) => {
			if (_.isPlainObject(data)) {
				return;
			}

			const networkAndChan = client.find(data.target);
			const newState = Boolean(data.shown);

			if (!networkAndChan) {
				return;
			}

			// Process multiple message at once for /collapse and /expand commands
			if (Array.isArray(data.messageIds)) {
				for (const msgId of data.messageIds) {
					const message = networkAndChan.chan.findMessage(msgId);

					if (message) {
						for (const preview of message.previews) {
							preview.shown = newState;
						}
					}
				}

				return;
			}

			const message = data.msgId ? networkAndChan.chan.findMessage(data.msgId) : null;

			if (!message) {
				return;
			}

			const preview = data.link ? message.findPreview(data.link) : null;

			if (preview) {
				preview.shown = newState;
			}
		});
	}

	socket.on("mentions:get", () => {
		socket.emit("mentions:list", client.mentions);
	});

	socket.on("mentions:dismiss", (msgId) => {
		if (typeof msgId !== "number") {
			return;
		}

		client.mentions.splice(
			client.mentions.findIndex((m) => m.msgId === msgId),
			1
		);
	});

	socket.on("mentions:dismiss_all", () => {
		client.mentions = [];
	});

	if (!Config.values.public) {
		socket.on("push:register", (subscription) => {
			if (!Object.prototype.hasOwnProperty.call(client.config.sessions, token)) {
				return;
			}

			const registration = client.registerPushSubscription(
				client.config.sessions[token],
				subscription
			);

			if (registration) {
				client.manager.webPush.pushSingle(client, registration, {
					type: "notification",
					timestamp: Date.now(),
					title: "The Lounge",
					body: "🚀 Push notifications have been enabled",
				});
			}
		});

		socket.on("push:unregister", () => client.unregisterPushSubscription(token));
	}

	const sendSessionList = () => {
		// TODO: this should use the ClientSession type currently in client
		const sessions = _.map(client.config.sessions, (session, sessionToken) => {
			return {
				current: sessionToken === token,
				active: _.reduce(
					client.attachedClients,
					(count, attachedClient) =>
						count + (attachedClient.token === sessionToken ? 1 : 0),
					0
				),
				lastUse: session.lastUse,
				ip: session.ip,
				agent: session.agent,
				token: sessionToken, // TODO: Ideally don't expose actual tokens to the client
			};
		});

		socket.emit("sessions:list", sessions);
	};

	socket.on("sessions:get", sendSessionList);

	if (!Config.values.public) {
		socket.on("setting:set", (newSetting) => {
			if (!_.isPlainObject(newSetting)) {
				return;
			}

			if (
				typeof newSetting.value === "object" ||
				typeof newSetting.name !== "string" ||
				newSetting.name[0] === "_"
			) {
				return;
			}

			// We do not need to do write operations and emit events if nothing changed.
			if (client.config.clientSettings[newSetting.name] !== newSetting.value) {
				client.config.clientSettings[newSetting.name] = newSetting.value;

				// Pass the setting to all clients.
				client.emit("setting:new", {
					name: newSetting.name,
					value: newSetting.value,
				});

				client.save();

				if (newSetting.name === "highlights" || newSetting.name === "highlightExceptions") {
					client.compileCustomHighlights();
				} else if (newSetting.name === "awayMessage") {
					if (typeof newSetting.value !== "string") {
						newSetting.value = "";
					}

					client.awayMessage = newSetting.value;
				}
			}
		});

		socket.on("setting:get", () => {
			if (!Object.prototype.hasOwnProperty.call(client.config, "clientSettings")) {
				socket.emit("setting:all", {});
				return;
			}

			const clientSettings = client.config.clientSettings;
			socket.emit("setting:all", clientSettings);
		});

		socket.on("search", async (query) => {
			const results = await client.search(query);
			socket.emit("search:results", results);
		});

		socket.on("mute:change", ({target, setMutedTo}) => {
			const networkAndChan = client.find(target);

			if (!networkAndChan) {
				return;
			}

			const {chan, network} = networkAndChan;

			// If the user mutes the lobby, we mute the entire network.
			if (chan.type === ChanType.LOBBY) {
				for (const channel of network.channels) {
					if (channel.type !== ChanType.SPECIAL) {
						channel.setMuteStatus(setMutedTo);
					}
				}
			} else {
				if (chan.type !== ChanType.SPECIAL) {
					chan.setMuteStatus(setMutedTo);
				}
			}

			for (const attachedClient of Object.keys(client.attachedClients)) {
				manager!.sockets.in(attachedClient).emit("mute:changed", {
					target,
					status: setMutedTo,
				});
			}

			client.save();
		});
	}

	socket.on("sign-out", (tokenToSignOut) => {
		// If no token provided, sign same client out
		if (!tokenToSignOut || typeof tokenToSignOut !== "string") {
			tokenToSignOut = token;
		}

		if (!Object.prototype.hasOwnProperty.call(client.config.sessions, tokenToSignOut)) {
			return;
		}

		delete client.config.sessions[tokenToSignOut];

		client.save();

		_.map(client.attachedClients, (attachedClient, socketId) => {
			if (attachedClient.token !== tokenToSignOut) {
				return;
			}

			const socketToRemove = manager!.sockets.of("/").sockets.get(socketId);

			socketToRemove!.emit("sign-out");
			socketToRemove!.disconnect();
		});

		// Do not send updated session list if user simply logs out
		if (tokenToSignOut !== token) {
			sendSessionList();
		}
	});

	// socket.join is a promise depending on the adapter.
	void socket.join(client.id);

	const sendInitEvent = (tokenToSend?: string) => {
		socket.emit("init", {
			active: openChannel,
			networks: client.networks.map((network) =>
				network.getFilteredClone(openChannel, lastMessage)
			),
			token: tokenToSend,
		});
		socket.emit("commands", inputs.getCommands());
	};

	if (Config.values.public) {
		sendInitEvent();
	} else if (!token) {
		client.generateToken((newToken) => {
			token = client.calculateTokenHash(newToken);
			client.attachedClients[socket.id].token = token;

			client.updateSession(token, getClientIp(socket), socket.request);
			sendInitEvent(newToken);
		});
	} else {
		client.updateSession(token, getClientIp(socket), socket.request);
		sendInitEvent();
	}
}

function getClientConfiguration(): SharedConfiguration | LockedSharedConfiguration {
	const common = {
		fileUpload: Config.values.fileUpload.enable,
		ldapEnabled: Config.values.ldap.enable,
		isUpdateAvailable: changelog.isUpdateAvailable,
		applicationServerKey: manager!.webPush.vapidKeys!.publicKey,
		version: Helper.getVersionNumber(),
		gitCommit: Helper.getGitCommit(),
		themes: themes.getAll(),
		defaultTheme: Config.values.theme,
		public: Config.values.public,
		useHexIp: Config.values.useHexIp,
		prefetch: Config.values.prefetch,
		fileUploadMaxFileSize: Uploader ? Uploader.getMaxFileSize() : undefined, // TODO can't be undefined?
	};

	const defaultsOverride = {
		nick: Config.getDefaultNick(), // expand the number part

		// TODO: this doesn't seem right, if the client needs this as a buffer
		// the client ought to add it on its own
		sasl: "",
		saslAccount: "",
		saslPassword: "",
	};

	if (!Config.values.lockNetwork) {
		const defaults: ConfigNetDefaults = {
			..._.clone(Config.values.defaults),
			...defaultsOverride,
		};
		const result: SharedConfiguration = {
			...common,
			defaults: defaults,
			lockNetwork: Config.values.lockNetwork,
		};
		return result;
	}

	// Only send defaults that are visible on the client
	const defaults: LockedConfigNetDefaults = {
		..._.pick(Config.values.defaults, ["name", "username", "password", "realname", "join"]),
		...defaultsOverride,
	};

	const result: LockedSharedConfiguration = {
		...common,
		lockNetwork: Config.values.lockNetwork,
		defaults: defaults,
	};

	return result;
}

function getServerConfiguration(): ServerConfiguration {
	return {...Config.values, ...{stylesheets: packages.getStylesheets()}};
}

function performAuthentication(this: Socket, data: AuthPerformData) {
	if (!_.isPlainObject(data)) {
		return;
	}

	const socket = this;
	let client: Client | undefined;
	let token: string;

	const finalInit = () => {
		let lastMessage = -1;

		if (data && "lastMessage" in data && data.lastMessage) {
			lastMessage = data.lastMessage;
		}

		// TODO: bonkers, but for now good enough until we rewrite the logic properly
		// initializeClient will check for if(openChannel) and as 0 is falsey it does the fallback...
		let openChannel = 0;

		if (data && "openChannel" in data && data.openChannel) {
			openChannel = data.openChannel;
		}

		// TODO: remove this once the logic is cleaned up
		if (!client) {
			throw new Error("finalInit called with undefined client, this is a bug");
		}

		initializeClient(socket, client, token, lastMessage, openChannel);
	};

	const initClient = () => {
		if (!client) {
			throw new Error("initClient called with undefined client");
		}

		// Configuration does not change during runtime of TL,
		// and the client listens to this event only once
		if (data && (!("hasConfig" in data) || !data.hasConfig)) {
			socket.emit("configuration", getClientConfiguration());

			socket.emit(
				"push:issubscribed",
				token && client.config.sessions[token].pushSubscription ? true : false
			);
		}

		const clientIP = getClientIp(socket);

		client.config.browser = {
			ip: clientIP,
			isSecure: getClientSecure(socket),
			language: getClientLanguage(socket),
		};

		// If webirc is enabled perform reverse dns lookup
		if (Config.values.webirc === null) {
			return finalInit();
		}

		const cb_client = client; // ensure that TS figures out that client can't be nil
		reverseDnsLookup(clientIP, (hostname) => {
			cb_client.config.browser!.hostname = hostname;

			finalInit();
		});
	};

	if (Config.values.public) {
		client = new Client(manager!);
		client.connect();
		manager!.clients.push(client);

		const cb_client = client; // ensure TS can see we never have a nil client
		socket.on("disconnect", function () {
			manager!.clients = _.without(manager!.clients, cb_client);
			cb_client.quit();
		});

		initClient();

		return;
	}

	if (typeof data.user !== "string") {
		return;
	}

	const authCallback = (success: boolean) => {
		// Authorization failed
		if (!success) {
			if (!client) {
				log.warn(
					`Authentication for non existing user attempted from ${colors.bold(
						getClientIp(socket)
					)}`
				);
			} else {
				log.warn(
					`Authentication failed for user ${colors.bold(data.user)} from ${colors.bold(
						getClientIp(socket)
					)}`
				);
			}

			socket.emit("auth:failed");
			return;
		}

		// If authorization succeeded but there is no loaded user,
		// load it and find the user again (this happens with LDAP)
		if (!client) {
			client = manager!.loadUser(data.user);

			if (!client) {
				throw new Error(`authCallback: ${data.user} not found after second lookup`);
			}
		}

		initClient();
	};

	client = manager!.findClient(data.user);

	// We have found an existing user and client has provided a token
	if (client && "token" in data && data.token) {
		const providedToken = client.calculateTokenHash(data.token);

		if (Object.prototype.hasOwnProperty.call(client.config.sessions, providedToken)) {
			token = providedToken;

			authCallback(true);
			return;
		}
	}

	if (!("user" in data && "password" in data)) {
		log.warn("performAuthentication: callback data has no user or no password");
		authCallback(false);
		return;
	}

	Auth.initialize().then(() => {
		// Perform password checking
		Auth.auth(manager, client, data.user, data.password, authCallback);
	});
}

function reverseDnsLookup(ip: string, callback: (hostname: string) => void) {
	// node can throw, even if we provide valid input based on the DNS server
	// returning SERVFAIL it seems: https://github.com/thelounge/thelounge/issues/4768
	// so we manually resolve with the ip as a fallback in case something fails
	try {
		dns.reverse(ip, (reverseErr, hostnames) => {
			if (reverseErr || hostnames.length < 1) {
				return callback(ip);
			}

			dns.resolve(
				hostnames[0],
				net.isIP(ip) === 6 ? "AAAA" : "A",
				(resolveErr, resolvedIps) => {
					// TODO: investigate SoaRecord class
					if (!Array.isArray(resolvedIps)) {
						return callback(ip);
					}

					if (resolveErr || resolvedIps.length < 1) {
						return callback(ip);
					}

					for (const resolvedIp of resolvedIps) {
						if (ip === resolvedIp) {
							return callback(hostnames[0]);
						}
					}

					return callback(ip);
				}
			);
		});
	} catch (err) {
		log.error(`failed to resolve rDNS for ${ip}, using ip instead`, (err as any).toString());
		setImmediate(callback, ip); // makes sure we always behave asynchronously
	}
}
