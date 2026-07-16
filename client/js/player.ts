type PlayerState = {
	playing: boolean;
	loading: boolean;
	music: boolean;
	title: string;
	musicTitle: string;
	volume: number;
};

type PlayerCallback = (state: PlayerState) => void;

type StreamSource = {
	title?: string;
	server_name?: string;
};

type IcecastStatus = {
	icestats?: {
		source?: StreamSource | StreamSource[];
	};
};

class Player {
	mediaPlayer: HTMLAudioElement;
	subscriptions: Record<string, PlayerCallback[]> = {};

	loading = false;
	playing = false;
	music = false;
	title = "Loading stream data...";
	musicTitle = "Loading stream data...";

	constructor() {
		this.mediaPlayer = new Audio();
		this.mediaPlayer.src = "https://listen.noagendastream.com/noagenda?type=.mp3";
		this.loading = true;

		this.mediaPlayer.addEventListener("canplaythrough", this.mediaCanPlay);
		this.mediaPlayer.addEventListener("loadedmetadata", this.mediaLoad);
		this.mediaPlayer.addEventListener("play", this.mediaUpdate);
		this.mediaPlayer.addEventListener("pause", this.mediaUpdate);
		this.mediaPlayer.addEventListener("timeupdate", this.mediaUpdate);

		this.fetchStreamData();
		setInterval(() => this.fetchStreamData(), 90 * 1000);
	}

	mediaLoad = () => {
		this.dispatchMediaEvent("load");
	};

	mediaCanPlay = () => {
		this.loading = false;
		this.dispatchMediaEvent("update");
	};

	mediaUpdate = () => {
		this.playing = !this.mediaPlayer.paused;

		if (this.loading && this.playing) {
			this.loading = false;
		}

		this.dispatchMediaEvent("update");
	};

	subscribe(eventId: string, callback: PlayerCallback) {
		this.subscriptions[eventId] ??= [];
		this.subscriptions[eventId].push(callback);

		return {
			unsubscribe: () => {
				const callbacks = this.subscriptions[eventId];
				callbacks.splice(callbacks.indexOf(callback) >>> 0, 1);
			},
		};
	}

	dispatch(eventId: string, event: PlayerState) {
		(this.subscriptions[eventId] || []).forEach((callback) => callback(event));
	}

	dispatchMediaEvent(eventId: string) {
		this.dispatch(eventId, {
			playing: this.playing,
			loading: this.loading,
			music: this.music,
			title: this.title,
			musicTitle: this.musicTitle,
			volume: Math.round(this.mediaPlayer.volume * 100),
		});
	}

	play() {
		void this.mediaPlayer.play();
	}

	pause() {
		this.mediaPlayer.pause();

		if (this.loading) {
			this.loading = false;
			this.dispatchMediaEvent("update");
		}
	}

	playMusic() {
		if (!this.music) {
			this.mediaPlayer.src = "https://listen.noagendastream.com/v4vmusic?type=.mp3";
			this.music = true;
			this.loading = true;
		}

		void this.mediaPlayer.play();
	}

	playLivestream() {
		if (this.music) {
			this.mediaPlayer.src = "https://listen.noagendastream.com/noagenda?type=.mp3";
			this.music = false;
			this.loading = true;
		}

		void this.mediaPlayer.play();
	}

	setVolume(volume: number) {
		this.mediaPlayer.volume = volume / 100;
		this.dispatchMediaEvent("update");
	}

	fetchStreamData() {
		void this.updateStreamData();
	}

	private async updateStreamData() {
		try {
			const response = await fetch("https://listen.noagendastream.com/status-json.xsl");
			const status = (await response.json()) as IcecastStatus;
			const sources = status.icestats?.source;

			if (!Array.isArray(sources)) {
				throw new Error("Invalid Icecast status response");
			}

			for (const source of sources) {
				const title = source.title ?? source.server_name;

				if (!title) {
					continue;
				}

				if (source.server_name === "No Agenda Stream") {
					this.title = title;
				} else if (source.server_name === "No Agenda Stream v4v Music") {
					this.musicTitle = title;
				}
			}

			if (!this.loading) {
				this.dispatchMediaEvent("update");
			}
		} catch {
			// eslint-disable-next-line no-console
			console.error("Failed to update stream title");
		}
	}
}

const naPlayer = new Player();

export default naPlayer;
