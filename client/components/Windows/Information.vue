<template>
	<div id="info" class="window" role="tabpanel" aria-label="Info">
		<Player />
		<div class="header">
			<SidebarToggle />
		</div>
		<div class="container">
			<h1 class="title">Information</h1>

			<h2 class="help-version-title">
				<span>About No Agenda</span>
			</h2>

			<div class="about">
				<p>
					The No Agenda Show is an award-winning podcast created by <a href="https://www.noagendashow.net/adam-curry" target="_blank">Adam Curry</a> and <a href="https://www.noagendashow.net/john-c-dvorak" target="_blank">John C. Dvorak</a>. The show relies on the direct support of the producers and consumers of the show using a <a href="https://value4value.info" target="_blank">value-for-value</a> model.
				</p>

				<p>
					<a
						href="https://www.noagendashow.net/"
						target="_blank"
						rel="noopener"
						class="btn"
					>No Agenda Show</a>
				</p>
			</div>

			<h2 class="help-version-title">
				<span>About No Agenda Stream</span>
			</h2>

			<p>
				The No Agenda Stream is an online audio broadcast that's live 24 hours a day, 7 days a week, filled with quality podcasts curated for listeners of No Agenda. In addition to running pre-recorded podcasts, some shows are recorded live on the air.
			</p>

			<p>
				<a
					href="https://playlist.noagendastream.com/"
					target="_blank"
					rel="noopener"
					class="website-link"
				>Stream Playlist</a>
			</p>

			<p>
				<a
					href="https://listen.noagendastream.com/"
					target="_blank"
					rel="noopener"
					class="website-link"
				>Direct Link</a>
			</p>

			<h2 class="help-version-title">
				<span>About the Troll Room</span>
			</h2>

			<div class="about">
				<p>
					The Troll Room is a public IRC server accessibly to anyone. Please note that you need register your
					nickname before you can start trolling.
				</p>

				<p>
					<a
						href="https://phoneboy.com/trollroom"
						target="_blank"
						rel="noopener"
						class="website-link"
					>How to use the Troll Room</a>
				</p>

				<p>
					<a
						href="http://adam.curry.com/html/HowtoregisterfortheT-22VC1Zc7QQMdBNX0nWzCbfMDwD7KZN.html"
						target="_blank"
						rel="noopener"
						class="website-link"
					>Registration Instructions</a>
				</p>

				<p>
					<router-link to="/help" class="documentation-link">Controls</router-link>
				</p>

				<p>
					<router-link v-if="store.state.networks.length === 0" to="/connect" class="btn">Connect to the Troll Room</router-link>
					<router-link v-else to="/chan-2" class="btn">Return to the troll room</router-link>
				</p>
			</div>

			<h2 class="help-version-title">
				<span>Credits</span>
			</h2>

			<div class="about">
				<p>
					The No Agenda Stream and the Troll Room are provided by <a href="https://noagenda.ninja">voidzero</a>.<br>
					The programming of the streams is managed by <a href="https://noauthority.social/@SirBemrose">Sir Bemrose</a>.<br>
					noagenda.stream was created by <a href="https://www.codedmonkey.com">Coded Monkey</a>.
				</p>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import {defineComponent} from "vue";
import {useStore} from "../../js/store";
import Player from "../Player.vue";
import SidebarToggle from "../SidebarToggle.vue";

export default defineComponent({
	name: "Information",
	components: {
		Player,
		SidebarToggle,
	},
	setup() {
		const store = useStore();
		const isApple = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) || false;
		const isTouch = navigator.maxTouchPoints > 0;

		return {
			isApple,
			isTouch,
			store,
		};
	},
});
</script>
