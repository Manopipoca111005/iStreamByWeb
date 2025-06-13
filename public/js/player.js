const API_BASE_URL = "https://api-lofru6ycsa-uc.a.run.app";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const imdbId = params.get("imdbId");
  const type = params.get("type");
  const title = decodeURIComponent(params.get("title") || "Player");
  const poster = decodeURIComponent(params.get("poster") || "");
  const playerContainer = document.getElementById("player-container");

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
      const torrentioUrl = `https://torrentio.strem.fun/stream/${type}/${imdbId}.json`;
      const torrentioRes = await fetch(torrentioUrl);
      const torrentioData = await torrentioRes.json();
      const streams = (torrentioData.streams || []).filter((s) => s.infoHash);
      if (!streams.length)
        throw new Error("Nenhum stream encontrado no Torrentio.");
      // Preferir MP4/H.264
      streams.sort((a, b) => {
        const aIsMp4 = a.title.toLowerCase().includes(".mp4");
        const bIsMp4 = b.title.toLowerCase().includes(".mp4");
        return aIsMp4 === bIsMp4 ? 0 : aIsMp4 ? -1 : 1;
      });
      const stream = streams[0];
      const magnet = `magnet:?xt=urn:btih:${
        stream.infoHash
      }&dn=${encodeURIComponent(stream.title)}`;
      // 2. Chamar a API backend para proxy Real-Debrid
      const apiUrl = `${API_BASE_URL.replace(
        /\/$/,
        ""
      )}/stream?magnet=${encodeURIComponent(magnet)}`;
      // Cria o elemento de vídeo
      const videoElement = document.createElement("video");
      videoElement.id = "player";
      videoElement.controls = true;
      videoElement.autoplay = true;
      videoElement.muted = true;
      if (poster) {
        videoElement.poster = poster;
      }
      // Define src e remove spinner quando pronto
      videoElement.addEventListener("loadeddata", () => {
        spinner.remove();
      });
      videoElement.addEventListener("error", () => {
        spinner.remove();
      });
      playerContainer.appendChild(videoElement);
      // Faz a requisição para o backend
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(
          `Erro ao buscar o stream: ${response.status} ${response.statusText}`
        );
      }
      const streamData = await response.json();
      console.log("Stream data:", streamData);
      if (!streamData.success || !streamData.url) {
        throw new Error(streamData.message || "Erro ao obter o URL do stream.");
      }
      videoElement.src = streamData.url;
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
      console.error("Erro ao preparar o stream:", error);
      showError(error.message || "Erro ao preparar o vídeo.");
    }
  } else {
    showError("Faltam informações (ID ou tipo) para carregar o vídeo.");
  }
});
