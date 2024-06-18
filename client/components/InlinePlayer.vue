<template>
	<div class="inline-player">
		<div class="ip-header">
			<button
				v-if="!playing"
				class="play"
				aria-label="Start playing livestream"
				@click="play"
			/>
			<button
				v-else
				class="pause"
				aria-label="Stop playing livestream"
				@click="pause"
			/>
			<span @click="togglePlaying">
				{{ title }}
			</span>
			<a :href="streamUrl" class="newtab" title="Open stream in new tab" target="_blank"></a>
		</div>
		<div class="ip-topic">{{ currentlyPlaying }}</div>
		<div v-if="playing" class="ip-footer">
			<button
				class="volume volume-high"
				aria-label="Current volume: 100%"
			/>
			<input type="range" min="0" max="100" :value="volume" @input="changeVolume" />
		</div>
	</div>
</template>

<script lang="ts">
import {defineComponent, onMounted, reactive, ref} from "vue";
import Player from "../js/player"
import {router} from '../js/router';

export default defineComponent({
	name: 'InlinePlayer',
	props: {
		music: Boolean,
	},
	setup(props) {
		const playing = ref(Player.playing && props.music === Player.music);
		const title = props.music ? "No Agenda Stream v4v Music" : "No Agenda Stream";
		const streamUrl = props.music ? "https://listen.noagendastream.com/v4vmusic?type=.mp3" : "https://listen.noagendastream.com/noagenda?type=.mp3";
		const currentlyPlaying = ref(props.music ? Player.musicTitle : Player.title);
		const volume = ref(100);

		const play = () => props.music ? Player.playMusic() : Player.playLivestream();
		const togglePlaying = () => Player.playing && props.music === Player.music ? Player.pause() : play();
		const pause = () => Player.pause();
		const openLivestream = async () => await router.push({name: "Livestream"});

		const changeVolume = ({target}) => {
			Player.setVolume(target.value);
		};

		onMounted(() => {
			Player.subscribe('update', (event: any) => {
				playing.value = event.playing && props.music === event.music;
				currentlyPlaying.value = props.music ? event.musicTitle : event.title;
				volume.value = event.volume;
			});
		});

		return {
			changeVolume,
			currentlyPlaying,
			openLivestream,
			play,
			playing,
			pause,
			streamUrl,
			title,
			togglePlaying,
			volume,
		};
	},
});
</script>
