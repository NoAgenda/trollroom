<template>
	<div id="player" class="header">
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
		<span
			class="topic"
			:title="`Currently playing: ${title}`"
			@click="openLivestream"
		>
			{{ title }}
		</span>
	</div>
</template>

<script lang="ts">
import {defineComponent, onMounted, ref} from "vue";
import Player from "../js/player"
import {router} from '../js/router';

export default defineComponent({
	name: 'Player',
	components: {},
	setup() {
		const playing = ref(Player.playing);
		const title = ref(Player.music ? Player.musicTitle : Player.title);

		const play = () => Player.play();
		const pause = () => Player.pause();
		const openLivestream = async () => await router.push({name: "Livestream"});

		onMounted(() => {
			Player.subscribe('update', (event: any) => {
				playing.value = event.playing;
				title.value = event.music ? event.musicTitle : event.title;
			});
		});

		return {
			openLivestream,
			play,
			playing,
			pause,
			title,
		};
	},
});
</script>
