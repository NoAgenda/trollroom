<template>
	<div id="livestream" class="window" role="tabpanel" aria-label="Livestream">
		<div class="header">
			<SidebarToggle />
		</div>

		<div class="container">
			<div class="content-logo">
				<img
					src="img/trollroom-logo.svg"
					alt="Troll Room"
					role="presentation"
				/>
			</div>

			<h1 class="title">No Agenda Stream</h1>

			<p class="lead">Welcome to the stream that's all talk, no commercials. No Agenda.</p>

			<p>
				<a
					href="#/information"
					class="documentation-link"
				>Learn more</a>
			</p>

			<InlinePlayer />
			<InlinePlayer :music="true" />

			<p>No Agenda Stream is part of the No Agenda network.</p>

			<p>
				<a
					href="https://www.noagendashow.net"
					target="_blank"
					rel="noopener"
					class="website-link"
				>No Agenda Show</a>
			</p>

			<p>
				<a
					href="https://www.noagendadonatins.com"
					target="_blank"
					rel="noopener"
					class="website-link"
				>No Agenda Donations</a>
			</p>

			<h2>Troll Room</h2>

			<a v-if="store.state.networks.length === 0" href="#/connect" class="btn">Connect to the Troll Room</a>
			<a v-else href="#/chan-2" class="btn">Return to the troll room</a>

			<p>
				<a
					href="#/information"
					class="documentation-link"
				>Learn more</a>
			</p>
		</div>
	</div>
</template>

<script lang="ts">
import {defineComponent} from "vue";

import InlinePlayer from '../InlinePlayer.vue';
import SidebarToggle from '../SidebarToggle.vue';
import {useStore} from '../../js/store';

export default defineComponent({
	name: "Livestream",
	components: {
		InlinePlayer,
		SidebarToggle,
	},
	setup() {
		const store = useStore();

		return {
			store,
		};
	},
});
</script>
