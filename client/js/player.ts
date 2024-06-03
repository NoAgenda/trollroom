class Player {
	mediaPlayer;
	subscriptions: object = {};

	loading: boolean = false;
	playing: boolean = false;
	music: boolean = false;
	title: string = 'Loading stream data...';
	musicTitle: string = 'Loading stream data...';

	constructor() {
		this.mediaPlayer = new Audio();
		this.mediaPlayer.src = 'https://listen.noagendastream.com/noagenda?type=.mp3';
		this.loading = true;

		this.mediaPlayer.addEventListener('canplaythrough', this.mediaCanPlay);
		this.mediaPlayer.addEventListener('loadedmetadata', this.mediaLoad);
		this.mediaPlayer.addEventListener('play', this.mediaUpdate);
		this.mediaPlayer.addEventListener('pause', this.mediaUpdate);
		this.mediaPlayer.addEventListener('timeupdate', this.mediaUpdate);

		this.fetchStreamData();

		setInterval(() => this.fetchStreamData(), 90 * 1000);
	}

	mediaLoad = () => {
		this.dispatchMediaEvent('load');
	};

	mediaCanPlay = () => {
		this.loading = false;

		this.dispatchMediaEvent('update');
	};

	mediaUpdate = () => {
		this.playing = !this.mediaPlayer.paused;

		if (this.loading && this.playing) {
			this.loading = false;
		}

		this.dispatchMediaEvent('update');
	};

	subscribe(eventId, callback) {
		if (!this.subscriptions[eventId]) {
			this.subscriptions[eventId] = [];
		}

		this.subscriptions[eventId].push(callback);

		return {
			unsubscribe: () => this.subscriptions[eventId].splice(this.subscriptions[eventId].indexOf(callback) >>> 0, 1),
		};
	}

	dispatch(eventId, event) {
		(this.subscriptions[eventId] || []).forEach(callback => callback(event));
	}

	dispatchMediaEvent(eventId) {
		const event = {
			playing: this.playing,
			loading: this.loading,
			music: this.music,
			title: this.title,
			musicTitle: this.musicTitle,
			volume: Math.round(this.mediaPlayer.volume * 100),
		};

		this.dispatch(eventId, event);
	}

	play() {
		this.mediaPlayer.play();
	}

	pause() {
		this.mediaPlayer.pause();

		if (this.loading) {
			this.loading = false;

			this.dispatchMediaEvent('update');
		}
	}

	playMusic() {
		if (!this.music) {
			this.mediaPlayer.src = 'https://listen.noagendastream.com/v4vmusic?type=.mp3';
			this.music = true;
			this.loading = true;
		}

		this.mediaPlayer.play();
	}

	playLivestream() {
		if (this.music) {
			this.mediaPlayer.src = 'https://listen.noagendastream.com/noagenda?type=.mp3';
			this.music = false;
			this.loading = true;
		}

		this.mediaPlayer.play();
	}

	setVolume(volume: number) {
		this.mediaPlayer.volume = volume / 100;

		this.dispatchMediaEvent('update');
	}

	fetchStreamData() {
		fetch('https://listen.noagendastream.com/status-json.xsl')
			.then(response => response.json())
			.then(response => {
				const sources = response?.icestats?.source;

				if (!(sources instanceof Array)) {
					throw new Error();
				}

				for (const source of sources) {
					const title = source.title ?? source.server_name;

					if (source.server_name === 'No Agenda Stream') {
						this.title = title;
					} else if (source.server_name === 'No Agenda Stream v4v Music') {
						this.musicTitle = title;
					}
				}

				if (!this.loading) {
					this.dispatchMediaEvent('update');
				}
			})
			.catch(() => {
				console.error('Failed to update stream title');
			});
	}
}

const naPlayer = new Player();

export default naPlayer;
