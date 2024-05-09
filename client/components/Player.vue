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
		>
			{{ title }}
		</span>
		<button
			class="volume volume-high"
			aria-label="Current volume: 100%"
		/>
	</div>
</template>

<script lang="ts">
import {defineComponent, onMounted, ref} from "vue";
import Player from "../js/player";
import MessageSearchForm from './MessageSearchForm.vue';

export default defineComponent({
	name: 'Player',
	components: {MessageSearchForm},
	setup() {
		const playing = ref(Player.playing);
		const title = ref(Player.title);

		const play = () => Player.play();
		const pause = () => Player.pause();

		onMounted(() => {
			Player.subscribe('update', (event: any) => {
				playing.value = event.playing;
				title.value = event.title;
			});
		});

		return {
			play,
			playing,
			pause,
			title,
		};
	},
});
</script>
