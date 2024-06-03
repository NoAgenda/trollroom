<!doctype html>
<html lang="en">
	<head>

	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, user-scalable=no">

	<link rel="preload" as="script" href="js/loading-error-handlers.js?v=<%- cacheBust %>">
	<link rel="preload" as="script" href="js/bundle.vendor.js?v=<%- cacheBust %>">
	<link rel="preload" as="script" href="js/bundle.js?v=<%- cacheBust %>">

	<link rel="stylesheet" href="css/style.css?v=<%- cacheBust %>">
	<link id="theme" rel="stylesheet" href="themes/<%- theme %>.css" data-server-theme="<%- theme %>">
	<% _.forEach(stylesheets, function(css) { %>
		<link rel="stylesheet" href="packages/<%- css %>">
	<% }); %>
	<style id="user-specified-css"></style>

	<title>No Agenda Stream</title>

	<!-- Browser tab icon -->
	<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32x32.png">
	<link rel="icon" type="image/png" sizes="16x16" href="img/favicon-16x16.png">
	<link rel="apple-touch-icon" sizes="180x180" href="img/apple-touch-icon.png">

	<link rel="manifest" href="trollroom.webmanifest">

	<meta name="application-name" content="No Agenda Stream">
	<meta name="apple-mobile-web-app-title" content="NA Stream">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
	<meta name="mobile-web-app-capable" content="yes">
	<meta name="theme-color" content="<%- themeColor %>">

	</head>
	<body class="<%- public ? " public" : "" %>" data-transports="<%- JSON.stringify(transports) %>">
		<div id="app">
			<div id="nojs" class="window">
				<div class="header">
					<button class="lt" aria-label="Toggle channel list"></button>
				</div>
				<div class="container">
					<div class="content-logo">
						<img src="/img/trollroom-logo.svg" alt="Troll Room" role="presentation">
					</div>
					<h1 class="title">No Agenda Stream</h1>
					<p class="lead">Welcome to the stream that's all talk, no commercials. No Agenda.</p>
					<p>
						<a href="https://www.noagendashow.net/about/stream" class="documentation-link">Learn more</a>
					</p>
					<div class="inline-player">
						<div class="ip-header">
							<span>No Agenda Stream</span>
						</div>
						<audio src="http://listen.noagendastream.com/noagenda.m3u" preload="none" controls></audio>
					</div>
					<div class="inline-player">
						<div class="ip-header">
							<span>No Agenda Stream v4v Music</span>
						</div>
						<audio src="http://listen.noagendastream.com/v4vmusic.m3u" preload="none" controls></audio>
					</div>
					<p>No Agenda Stream is part of the No Agenda network.</p>
					<p>
						<a href="https://www.noagendashow.net" target="_blank" rel="noopener" class="website-link">
							No Agenda Show
						</a>
					</p>
					<p>
						<a href="https://www.noagendadonations.com" target="_blank" rel="noopener" class="website-link">
							No Agenda Donations
						</a>
					</p>
					<h2>Troll Room</h2>
					<p>
						To connect with the Troll Room you need to enable JavaScript, or join us with your favorite IRC
						app at #NoAgenda on irc.zeronode.net.
					</p>
					<p><a href="https://www.noagendashow.net/about/troll-room" class="documentation-link">Learn more</a></p>
				</div>
			</div>
		</div>

		<div id="loading">
			<div class="window">
				<div id="loading-status-container">
					<img src="img/trollroom-logo.svg" class="logo" alt="" width="256" height="256">
					<img src="img/trollroom-logo.svg" class="logo-inverted" alt="" width="256" height="256">
					<p id="loading-page-message">No Agenda Stream requires a modern browser with JavaScript enabled.</p>
				</div>
				<div id="loading-reload-container">
					<p id="loading-slow">This is taking longer than it should, there might be connectivity issues.</p>
					<button id="loading-reload" class="btn">Reload page</button>
				</div>
			</div>
		</div>

		<script src="js/loading-error-handlers.js?v=<%- cacheBust %>"></script>
		<script src="js/bundle.vendor.js?v=<%- cacheBust %>"></script>
		<script src="js/bundle.js?v=<%- cacheBust %>"></script>
	</body>
</html>
