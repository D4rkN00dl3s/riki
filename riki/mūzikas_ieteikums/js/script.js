
$(function () {
	// === Constants ===
	const PEEP_ID = 11420468;
	const CHUNK = 10;
	const MAX_TRACKS = 50;

	// === Cached DOM Elements ===
	const $findButton = $('#find-button');
	const $tracks = $('#tracks');
	const $controlsContainer = $('#controls-container');
	const $moodSelect = $('#mood-select');
	const $body = $('body');
	const $h1 = $('h1');
	const $peepToggle = $('#peep-toggle');
	const $spinner = $('#spinner');

	// === State ===
	const state = {
		mode: 'normal',
		currentMood: null,
		lists: { peep: [], normal: [] },
		indices: { peep: 0, normal: 0 },
		cache: {},
		usedPlaylists: {},
		isLoading: false
	};

	const moodKeywords = { happy: 'happy', sad: 'sad', chill: 'chill', energetic: 'energetic' };

	// === UI Helpers ===
	function showSpinner() { $spinner.removeClass('hidden'); }
	function hideSpinner() { $spinner.addClass('hidden'); }

	function showError(message, fallbackText) {
		alert(message);
		hideSpinner();
		$findButton.text(fallbackText || 'Error').prop('disabled', true);
	}

	function resetView() {
		$tracks.empty();
		hideSpinner();
		$('#controls').toggle(state.mode === 'normal');
		$findButton.prop('disabled', false).text('Atrast mūziku');
	}

	function applyPeepStyle() {
		$controlsContainer.hide();
		$h1.text('🎵 Peep Mode');
		$peepToggle.text('Exit Peep');
		$body.addClass('peep-mode');
	}

	function removePeepStyle() {
		$controlsContainer.show();
		$h1.text('🎧 Moodify');
		$peepToggle.text('Peep Mode');
		$body.removeClass('peep-mode');
	}

	function pickRandom(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	// === Track Display ===
	function displayTracks() {
		const key = state.mode;
		const list = state.lists[key] || [];
		let idx = state.indices[key];

		if (idx >= list.length || idx >= MAX_TRACKS) {
			if (key === 'normal') return loadNormalTracks();
			$findButton.text('No more').prop('disabled', true);
			return hideSpinner();
		}

		showSpinner();
		const end = Math.min(idx + CHUNK, list.length, MAX_TRACKS);
		list.slice(idx, end).forEach(tr => $tracks.append(createTrackDiv(tr)));
		state.indices[key] = end;

		const more = state.indices[key] < list.length && state.indices[key] < MAX_TRACKS;
		$findButton.text(more ? 'Iegūt vēl' : (key === 'normal' ? 'Notīrīt' : 'No more'));
		hideSpinner();
	}

	// === Fetchers ===
	function fetchPeepTracks() {
		return $.ajax({
			url: `https://api.deezer.com/artist/${PEEP_ID}/top?limit=100&output=jsonp`,
			dataType: 'jsonp'
		});
	}

	function searchPlaylists(q) {
		return $.ajax({
			url: `https://api.deezer.com/search/playlist?q=${encodeURIComponent(q)}&output=jsonp`,
			dataType: 'jsonp'
		});
	}

	function fetchPlaylistTracks(id) {
		return $.ajax({
			url: `https://api.deezer.com/playlist/${id}?output=jsonp`,
			dataType: 'jsonp'
		});
	}

	// === Track Loading ===
	async function loadPeepTracks() {
		state.mode = 'peep'; resetView(); applyPeepStyle(); showSpinner();
		try {
			const res = await fetchPeepTracks();
			state.lists.peep = (res.data || []).filter(tr => tr.preview && tr.artist.id === PEEP_ID);
			state.indices.peep = 0;
			$findButton.text('More');
			displayTracks();
		} catch (e) {
			console.error(e);
			showError('Kļūda ielādējot Peep dziesmas');
		}
	}

	async function loadNormalTracks() {
		if (state.isLoading) return;
		state.isLoading = true;
		state.mode = 'normal'; resetView(); removePeepStyle(); showSpinner();
		try {
			const mood = $moodSelect.val();
			if (mood !== state.currentMood) {
				state.currentMood = mood;
				state.indices.normal = 0;
			}

			if (!state.cache[mood]) {
				const res = await searchPlaylists(moodKeywords[mood]);
				state.cache[mood] = Array.isArray(res.data) ? res.data : [];
			}

			if (state.cache[mood].length === 0) {
				return showError('Neatrasti noskaņojuma pleilisti: ' + mood, 'No playlists');
			}

			state.usedPlaylists[mood] = state.usedPlaylists[mood] || [];
			let available = state.cache[mood].filter(p => !state.usedPlaylists[mood].includes(p.id));
			if (available.length === 0) {
				state.usedPlaylists[mood] = [];
				available = [...state.cache[mood]];
			}

			const pl = pickRandom(available);
			if (!pl || !pl.id) return showError('Pleilista datu kļūda');

			state.usedPlaylists[mood].push(pl.id);
			const res = await fetchPlaylistTracks(pl.id);
			const tracks = Array.isArray(res.tracks?.data) ? res.tracks.data : [];
			state.lists.normal = tracks.filter(t => t.preview);
			state.indices.normal = 0;
			$findButton.text('More');

			if (state.lists.normal.length === 0) {
				alert('Pleilists tukšs, tiek ielādēts cits...');
				return loadNormalTracks();
			}
			displayTracks();
		} catch (e) {
			console.error(e);
			showError('Kļūda ielādējot mūziku');
		} finally {
			state.isLoading = false;
		}
	}

	// === Track DOM ===
	function createTrackDiv(tr) {
		const div = $('<div>').addClass('track').data('track', tr);
		$('<img>').attr('src', tr.album.cover_medium).attr('loading', 'lazy').appendTo(div);

		const info = $('<div>').addClass('track-info').appendTo(div);
		$('<p>').html(`<strong><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(tr.title + ' ' + tr.artist.name)}" target="_blank">${tr.title}</a></strong>`).appendTo(info);
		$('<p>').html(`<a href="https://open.spotify.com/search/${encodeURIComponent(tr.artist.name)}" target="_blank">${tr.artist.name}</a>`).appendTo(info);

		div.on('click', (e) => {
			if ($(e.target).is('a')) return;
			playTrack(tr, div);
		});

		return div;
	}

	// === Player ===
	let currentTrackDiv = null;
	const player = $('#global-player');
	const audio = player.find('audio')[0];
	const btnPlay = player.find('.play');
	const btnPrev = player.find('.prev');
	const btnNext = player.find('.next');
	const bar = player.find('.bar');
	const time = player.find('.time');
	const vol = player.find('.volume')[0];

	function playTrack(track, trackDiv) {
		if (audio.src !== track.preview) audio.src = track.preview;
		currentTrackDiv?.removeClass('playing');
		currentTrackDiv = trackDiv;
		currentTrackDiv.addClass('playing');
		audio.play();
		$('.now-playing').text(`${track.title} — ${track.artist.name}`);
	}

	btnPlay.on('click', () => audio.paused ? audio.play() : audio.pause());
	btnPrev.on('click', () => {
		if (!currentTrackDiv) return;
		const prev = currentTrackDiv.prev('.track');
		if (prev.length) playTrack(prev.data('track'), prev);
	});
	btnNext.on('click', () => {
		if (!currentTrackDiv) return;
		const next = currentTrackDiv.next('.track');
		if (next.length) playTrack(next.data('track'), next);
	});

	vol.oninput = () => {
		audio.volume = vol.value;
		localStorage.setItem('volume', vol.value);
	};

	const savedVolume = localStorage.getItem('volume');
	if (savedVolume !== null) {
		vol.value = savedVolume;
		audio.volume = savedVolume;
	}

	player.find('.progress').on('click', e => {
		const r = player.find('.progress')[0].getBoundingClientRect();
		audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
	});

	audio.ontimeupdate = () => {
		if (!audio.duration) return;
		const pct = (audio.currentTime / audio.duration) * 100;
		bar.css('width', pct + '%');
		time.text(`${Math.floor(audio.currentTime / 60)}:${String(Math.floor(audio.currentTime % 60)).padStart(2, '0')}`);
	};
	audio.onplay = () => { $('audio').not(audio).each((i, a) => a.pause()); btnPlay.text('⏸️'); };
	audio.onpause = () => btnPlay.text('▶️');
	audio.onended = () => {
		const next = currentTrackDiv?.next('.track');
		if (next.length) playTrack(next.data('track'), next);
	};

	// === Events ===
	if (localStorage.getItem('theme') === 'dark') $body.addClass('dark');

	$('#theme-toggle').on('click', () => {
		$body.toggleClass('dark');
		localStorage.setItem('theme', $body.hasClass('dark') ? 'dark' : 'light');
	});

	$peepToggle.on('click', () => state.mode === 'peep' ? loadNormalTracks() : loadPeepTracks());

	$findButton.on('click', () => {
		const sel = $moodSelect.val();
		if (state.mode === 'normal' && (state.lists.normal.length === 0 || sel !== state.currentMood || state.indices.normal >= state.lists.normal.length || state.indices.normal >= MAX_TRACKS)) {
			loadNormalTracks();
		} else {
			displayTracks();
		}
	});

	// === Global Key Events ===
	$(document).on('keydown', function (e) {
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
		if (e.code === 'Space') {
			e.preventDefault();
			audio.paused ? audio.play() : audio.pause();
		}
	});
});
