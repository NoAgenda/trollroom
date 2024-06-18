<template>
	<div v-if="!store.state.appLoaded" id="connect" class="window" role="tabpanel" aria-label="Connect">
		<Player />
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
		</div>
		<div class="container">
			<h1 class="title">Connect to Troll Room</h1>

			<p>{{ store.state.currentUserVisibleError }}</p>

			<p v-if="customError">{{ customError }}</p>

			<p>
				If the Troll Room fails to load correctly, make sure you're connected to the internet and reload
				the page.
			</p>
			<p>
				If this message persists, try contacting one of our resident Dudes named Ben,
				<a href="https://noauthority.social/@woodstock" target="_blank">Coded Monkey</a> or
				<a href="https://podcastindex.social/@voidzero" target="_blank">voidzero</a>.
			</p>
		</div>
	</div>
	<NetworkForm v-else :handle-submit="handleSubmit" :defaults="defaults" :disabled="disabled" />
</template>

<script lang="ts">
import {defineComponent, ref} from "vue";

import socket from "../../js/socket";
import {useStore} from "../../js/store";
import NetworkForm, {NetworkFormDefaults} from "../NetworkForm.vue";
import Player from "../Player.vue";
import SidebarToggle from "../SidebarToggle.vue";

export default defineComponent({
	name: "Connect",
	components: {
		NetworkForm,
		Player,
		SidebarToggle,
	},
	props: {
		queryParams: Object,
	},
	setup(props) {
		const store = useStore();

		const customError = ref<string|null>(null);
		const disabled = ref(false);

		if (window.g_TrollRoomHandleError) {
			window.g_TrollRoomHandleError((message) => {
				customError.value = message;
			});
		}

		const handleSubmit = (data: Record<string, any>) => {
			disabled.value = true;
			socket.emit("network:new", data);
		};

		const parseOverrideParams = (params?: Record<string, string>) => {
			if (!params) {
				return {};
			}

			const parsedParams: Record<string, any> = {};

			for (let key of Object.keys(params)) {
				let value = params[key];

				// Param can contain multiple values in an array if its supplied more than once
				if (Array.isArray(value)) {
					value = value[0];
				}

				// Support `channels` as a compatibility alias with other clients
				if (key === "channels") {
					key = "join";
				}

				if (
					!Object.prototype.hasOwnProperty.call(
						store.state.serverConfiguration?.defaults,
						key
					)
				) {
					continue;
				}

				// When the network is locked, URL overrides should not affect disabled fields
				if (
					store.state.serverConfiguration?.lockNetwork &&
					["name", "host", "port", "tls", "rejectUnauthorized"].includes(key)
				) {
					continue;
				}

				if (key === "join") {
					value = value
						.split(",")
						.map((chan) => {
							if (!chan.match(/^[#&!+]/)) {
								return `#${chan}`;
							}

							return chan;
						})
						.join(", ");
				}

				// Override server provided defaults with parameters passed in the URL if they match the data type
				switch (typeof store.state.serverConfiguration?.defaults[key]) {
					case "boolean":
						if (value === "0" || value === "false") {
							parsedParams[key] = false;
						} else {
							parsedParams[key] = !!value;
						}

						break;
					case "number":
						parsedParams[key] = Number(value);
						break;
					case "string":
						parsedParams[key] = String(value);
						break;
				}
			}

			return parsedParams;
		};

		const defaults = ref<Partial<NetworkFormDefaults>>(
			Object.assign(
				{},
				store.state.serverConfiguration?.defaults,
				parseOverrideParams(props.queryParams)
			)
		);

		return {
			customError,
			defaults,
			disabled,
			handleSubmit,
			store,
		};
	},
});
</script>
