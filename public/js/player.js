const API_BASE_URL = "https://api-lofru6ycsa-uc.a.run.app";
//const API_BASE_URL = "http://127.0.0.1:5001/istreambyweb/us-central1/api";


document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const imdbId = params.get("imdbId");
  const type = params.get("type");
  const title = decodeURIComponent(params.get("title") || "Player");
  const poster = decodeURIComponent(params.get("poster") || "");
  const playerContainer = document.getElementById("player-container");
  const season = params.get("season");
  const episode = params.get("episode");

  document.title = title + " - iStreamByWeb";

  if (!playerContainer) {
    console.error("Elemento #player-container não encontrado.");
    return;
  }

  const showError = (message) => {
    playerContainer.innerHTML = `<div style="color: white; text-align: center; padding: 20px; font-family: sans-serif;"><h1>Erro ao Carregar</h1><p>${message}</p></div>`;
  };

  if (imdbId && type) {
    try {
      // Adiciona spinner de loading
      const spinner = document.createElement("div");
      spinner.id = "player-loading-spinner";
      spinner.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 0"><div class="loading-spinner" style="margin-bottom:16px;"><i class="fas fa-spinner fa-spin fa-3x"></i></div><div style="color:#fff;font-size:1.2em;">Preparando o vídeo, pode demorar até 1 minuto...</div></div>';
      playerContainer.appendChild(spinner);
      // 1. Buscar o magnet do Torrentio localmente
      let torrentioUrl;
      if (type === "series" && season && episode) {
        torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
      } else {
        torrentioUrl = `https://torrentio.strem.fun/stream/${type}/${imdbId}.json`;
      }
      const torrentioRes = await fetch(torrentioUrl);
      const torrentioData = await torrentioRes.json();
      const streams = (torrentioData.streams || []).filter((s) => s.infoHash);
      if (!streams.length)
        throw new Error("Nenhum stream encontrado no Torrentio.");
      // FILTRO EXCLUSIVO: só mostrar torrents cujo título contenha apenas 'deadpool' se o imdbId for do Deadpool 1
      let filteredStreams = streams;
      if (imdbId === "tt1431045") {
        filteredStreams = streams.filter((s) => {
          const t = (s.title || '').toLowerCase();
          // Aceita apenas se o título começar com 'deadpool' e não mencionar x-men, collection, pack, etc
          return /^deadpool(\s|$)/.test(t) && !/(x[- ]?men|collection|pack|xmen|x\s?men)/.test(t);
        });
        if (!filteredStreams.length) filteredStreams = streams; // fallback se não encontrar nenhum
      }      // Filtrar apenas MP4/H.264
      filteredStreams = filteredStreams.filter(stream => {
        const title = stream.title.toLowerCase();
        // Verifica se é MP4 ou H.264/AVC
        const isMP4 = title.includes('.mp4');
        const isH264 = title.includes('h264') || title.includes('h.264') || title.includes('avc');
        return isMP4 || isH264;
      });

      // Se não encontrar nenhum MP4/H.264, mostra uma mensagem específica
      if (filteredStreams.length === 0) {
        throw new Error("Nenhum stream MP4/H.264 encontrado. Por favor, tente outro título.");
      }

      // Ordenar por qualidade (assumindo que streams com qualidade especificada são melhores)
      filteredStreams.sort((a, b) => {
        // Priorizar streams com qualidade especificada
        if (a.quality && !b.quality) return -1;
        if (!a.quality && b.quality) return 1;

        // Entre streams MP4, priorizar os que têm H.264 explicitamente mencionado
        const aHasH264 = a.title.toLowerCase().match(/h\.?264|avc/);
        const bHasH264 = b.title.toLowerCase().match(/h\.?264|avc/);
        if (aHasH264 && !bHasH264) return -1;
        if (!aHasH264 && bHasH264) return 1;

        return 0;
      });
      // Exibir lista de streams para o usuário escolher
      spinner.remove();
      playerContainer.innerHTML = `<div style='color:#fff;font-family:sans-serif;padding:16px;'><h2>Escolha uma fonte para assistir:</h2><div id='stream-list'></div></div>`;
      const streamList = document.getElementById('stream-list');
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Pesquisar stream...';
      searchInput.style = 'margin: 8px 0; padding: 8px; width: 100%; max-width: 400px; font-size: 1em; border-radius: 6px; border: 1px solid #555; background: #111; color: #fff;';
      const containerDiv = playerContainer.querySelector('div'); // pega a div que contém o stream-list
      containerDiv.insertBefore(searchInput, streamList);


      // Função de filtro
      searchInput.addEventListener('input', () => {
        const filter = searchInput.value.toLowerCase();


        const buttons = streamList.querySelectorAll('button');
        buttons.forEach(btn => {
          const txt = normalize(btn.textContent);

          btn.style.display = txt.includes(filter) ? 'block' : 'none';
        });
      });
      filteredStreams.forEach((stream, idx) => {
        const btn = document.createElement('button');
        const quality = stream.quality ? ` [${stream.quality}]` : '';
        const format = stream.title.toLowerCase().includes('h264') || stream.title.toLowerCase().includes('h.264') ? ' [H.264]' :
          stream.title.toLowerCase().includes('avc') ? ' [AVC]' : ' [MP4]';
        const isMP4 = stream.title.toLowerCase().includes('.mp4');
        const isH264 = stream.title.toLowerCase().includes('h264') || stream.title.toLowerCase().includes('h.264') || stream.title.toLowerCase().includes('avc');
        const mobileIcon = (isMP4 && isH264) ? ' 📱' : '';
        btn.textContent = `${stream.title || 'Stream'}${quality}${format}${mobileIcon}`;

        btn.style = 'display:block;margin:8px 0;padding:10px 16px;font-size:1em;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer;text-align:left;word-break:break-word;';
        btn.onclick = async () => {
          playerContainer.innerHTML = '';
          const loading = document.createElement('div');
          loading.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 0"><div class="loading-spinner" style="margin-bottom:16px;"><i class="fas fa-spinner fa-spin fa-3x"></i></div><div style="color:#fff;font-size:1.2em;">Preparando o vídeo...</div></div>';
          playerContainer.appendChild(loading);
          // Limpa o magnet para garantir que só o hash puro seja enviado
          let magnet = `magnet:?xt=urn:btih:${stream.infoHash}`;
          const cleanTitle = (stream.title || '').replace(/[\u00000-\u1FAFF\u2600-\u27BF]/gu, '').replace(/\s+/g, ' ').replace(/\n/g, '').trim();
          if (cleanTitle) {
            magnet += `&dn=${encodeURIComponent(cleanTitle)}`;
          }
          const apiUrl = `${API_BASE_URL.replace(/\/$/, "")}/stream?magnet=${encodeURIComponent(magnet)}`;
          try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Erro ao buscar o stream: ${response.status} ${response.statusText}`);
            const streamData = await response.json();
            if (!streamData.success || !streamData.url) throw new Error(streamData.message || "Erro ao obter o URL do stream.");
            // Cria o elemento de vídeo
            const videoElement = document.createElement("video");
            videoElement.id = "player";
            videoElement.controls = true;
            videoElement.autoplay = true;
            videoElement.muted = true;
            if (poster) videoElement.poster = poster;
            videoElement.src = streamData.url;
            videoElement.addEventListener("loadeddata", () => loading.remove());
            videoElement.addEventListener("error", () => loading.remove());
            playerContainer.appendChild(videoElement);
            if (typeof Plyr !== "undefined") {
              const player = new Plyr(videoElement, {
                title: title,
                autoplay: true,
                muted: true,
                settings: ["captions", "quality", "speed", "loop"],
                controls: [
                  "play-large",
                  "restart",
                  "rewind",
                  "play",
                  "fast-forward",
                  "progress",
                  "current-time",
                  "duration",
                  "mute",
                  "volume",
                  "captions",
                  "settings",
                  "pip",
                  "airplay",
                  "fullscreen",
                ],
              });
              player.on("error", (event) => {
                console.error("Erro no leitor Plyr:", event);
                showError("O leitor de vídeo encontrou um erro inesperado.");
              });
            }
          } catch (error) {
            showError(error.message || "Erro ao preparar o vídeo.");
          }
        };
        streamList.appendChild(btn);
      });
      return;
    } catch (error) {
      console.error("Erro ao preparar o stream:", error);
      showError(error.message || "Erro ao preparar o vídeo.");
    }
  } else {
    showError("Faltam informações (ID ou tipo) para carregar o vídeo.");
  }
});
