// A API_BASE_URL deve apontar para o seu backend.
const API_BASE_URL = "https://api-lofru6ycsa-uc.a.run.app";
//const API_BASE_URL = "http://127.0.0.1:5001/istreambyweb/us-central1/api"; // Se estiver testando localmente, use esta.

let videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm"];
let incompatibleCodecs = ["h265", "hevc", "vp9", "av1"];
const userAgent = navigator.userAgent || window.opera;
// Função para buscar legendas disponíveis (chama seu backend)
async function fetchSubtitles(imdbId, type, season, episode) {
  try {
    let subtitlesUrl = `${API_BASE_URL}/subtitles/search?imdbId=${imdbId}&languages=pt-pt,pt-br,en,es,fr`;

    if (type === "series" && season && episode) {
      subtitlesUrl += `&type=series&season=${season}&episode=${episode}`;
    }

    console.log("Fetching subtitles from backend:", subtitlesUrl);
    const response = await fetch(subtitlesUrl);

    if (!response.ok) {
      console.warn(
        "Erro ao buscar legendas:",
        response.status,
        response.statusText
      );
      const errorData = await response.json().catch(() => ({}));
      console.warn("Detalhes do erro do backend:", errorData);
      return [];
    }

    const data = await response.json();
    return data.success ? data.subtitles : [];
  } catch (error) {
    console.warn("Erro ao buscar legendas via backend:", error);
    return [];
  }
}

// Função para obter URL de download da legenda (chama seu backend)
async function getSubtitleDownloadUrl(fileId) {
  try {
    // Agora chama o endpoint de download no SEU backend
    const response = await fetch(`${API_BASE_URL}/subtitles/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_id: parseInt(fileId) }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Erro ao obter URL de download do backend: ${
          response.status
        }. Detalhes: ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    // O seu backend deve retornar 'download_url' ou similar, não 'link'
    return data.download_url || null;
  } catch (error) {
    console.error(
      "Erro ao obter URL de download da legenda via backend:",
      error
    );
    return null;
  }
}

// Função para converter legenda para formato WebVTT
function convertSrtToVtt(srtContent) {
  let vttContent = "WEBVTT\n\n";
  vttContent += srtContent.replace(
    /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g,
    "$1:$2:$3.$4"
  );
  return vttContent;
}

// Função para carregar legenda no player
async function loadSubtitleIntoPlayer(player, fileId, language, label) {
  try {
    console.log(`Carregando legenda: ${label} (file_id: ${fileId})`);

    // Obter URL de download (esta URL virá do seu backend, que por sua vez obteve da OpenSubtitles)
    const downloadUrl = await getSubtitleDownloadUrl(fileId);
    if (!downloadUrl) {
      throw new Error("Não foi possível obter URL de download da legenda.");
    }

    // Fazer proxy do download através do nosso backend
    // Este proxy é necessário porque a URL de download da legenda (do OpenSubtitles)
    // pode ter problemas de CORS se acessada diretamente do frontend.
    // O seu backend atuará como um intermediário.
    const proxyUrl = `${API_BASE_URL}/subtitles/proxy?url=${encodeURIComponent(
      downloadUrl
    )}`;

    // Buscar conteúdo da legenda através do seu endpoint de proxy
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Erro ao baixar legenda via proxy: ${response.status}`);
    }

    const srtContent = await response.text();
    const vttContent = convertSrtToVtt(srtContent);

    // Criar blob URL para a legenda
    const blob = new Blob([vttContent], { type: "text/vtt" });
    const blobUrl = URL.createObjectURL(blob);

    // Adicionar track de legenda ao vídeo
    const videoElement = player.media;
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = label;
    track.srclang = language;
    track.src = blobUrl;
    track.default = language === "pt"; // Português como padrão

    videoElement.appendChild(track);

    console.log(`Legenda carregada: ${label}`);
    return true;
  } catch (error) {
    console.error(`Erro ao carregar legenda ${label}:`, error);
    return false;
  }
}

// Função para criar seletor de legendas melhorado
function createSubtitlePicker(subtitles, onSubtitleSelect) {
  const container = document.createElement("div");
  container.id = "subtitle-picker";
  container.style.cssText = `
    margin: 16px 0;
    padding: 20px;
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    border-radius: 12px;
    border: 1px solid #333;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #333;
  `;

  const icon = document.createElement("span");
  icon.innerHTML = "🎬";
  icon.style.cssText = `
    font-size: 1.5em;
    margin-right: 12px;
  `;

  const title = document.createElement("h3");
  title.textContent = "Legendas Disponíveis";
  title.style.cssText = `
    color: #fff;
    margin: 0;
    font-size: 1.2em;
    font-weight: 600;
    flex: 1;
  `;

  const badge = document.createElement("span");
  badge.textContent = `${subtitles.length} encontrada${
    subtitles.length !== 1 ? "s" : ""
  }`;
  badge.style.cssText = `
    background: #0066cc;
    color: #fff;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.8em;
    font-weight: 500;
  `;

  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(badge);
  container.appendChild(header);

  if (subtitles.length === 0) {
    const noSubtitles = document.createElement("div");
    noSubtitles.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #888;">
        <div style="font-size: 2em; margin-bottom: 8px;">📝</div>
        <p style="margin: 0; font-style: italic;">Nenhuma legenda encontrada para este conteúdo.</p>
      </div>
    `;
    container.appendChild(noSubtitles);
    return container;
  }
  subtitles.sort((a, b) => {
    const langOrder = { "pt-pt": 0, "pt-br": 1, en: 2, es: 3 };
    const aOrder =
      langOrder[a.language.toLowerCase()] !== undefined
        ? langOrder[a.language.toLowerCase()]
        : 99;
    const bOrder =
      langOrder[b.language.toLowerCase()] !== undefined
        ? langOrder[b.language.toLowerCase()]
        : 99;
    return aOrder - bOrder;
  });

  const groupedSubtitles = subtitles.reduce((groups, subtitle) => {
    const lang = subtitle.language;
    if (!groups[lang]) groups[lang] = [];
    groups[lang].push(subtitle);
    return groups;
  }, {});

  const languagesGrid = document.createElement("div");
  languagesGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  `;

  Object.entries(groupedSubtitles).forEach(([language, langSubtitles]) => {
    const langSection = document.createElement("div");
    langSection.style.cssText = `
      background: #222;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #333;
    `;

    const langHeader = document.createElement("div");
    langHeader.style.cssText = `
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #333;
    `;

    const flagEmoji = getLanguageFlag(language);
    const langFlag = document.createElement("span");
    langFlag.textContent = flagEmoji;
    langFlag.style.cssText = `
      font-size: 1.2em;
      margin-right: 8px;
    `;

    const langTitle = document.createElement("h4");
    langTitle.textContent = getLanguageName(language);
    langTitle.style.cssText = `
      color: #fff;
      margin: 0;
      font-size: 1em;
      font-weight: 600;
      flex: 1;
    `;

    const langCount = document.createElement("span");
    langCount.textContent = `${langSubtitles.length}`;
    langCount.style.cssText = `
      background: #444;
      color: #ccc;
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 0.8em;
      font-weight: 500;
    `;

    langHeader.appendChild(langFlag);
    langHeader.appendChild(langTitle);
    langHeader.appendChild(langCount);
    langSection.appendChild(langHeader);

    const sortedSubtitles = langSubtitles.sort((a, b) => {
      if (a.from_trusted !== b.from_trusted)
        return b.from_trusted - a.from_trusted;
      if ((b.download_count || 0) !== (a.download_count || 0))
        return (b.download_count || 0) - (a.download_count || 0);
      if ((b.ratings || 0) !== (a.ratings || 0))
        return (b.ratings || 0) - (a.ratings || 0);
      return (b.hd ? 1 : 0) - (a.hd ? 1 : 0);
    });

    sortedSubtitles.slice(0, 3).forEach((subtitle, index) => {
      const button = document.createElement("button");

      const badges = [];
      if (subtitle.hd)
        badges.push(
          '<span style="background: #00cc00; color: #fff; padding: 2px 4px; border-radius: 3px; font-size: 0.7em; margin-left: 4px;">HD</span>'
        );
      if (subtitle.from_trusted)
        badges.push(
          '<span style="background: #0066cc; color: #fff; padding: 2px 4px; border-radius: 3px; font-size: 0.7em; margin-left: 4px;">✓</span>'
        );
      if (subtitle.hearing_impaired)
        badges.push(
          '<span style="background: #cc6600; color: #fff; padding: 2px 4px; border-radius: 3px; font-size: 0.7em; margin-left: 4px;">CC</span>'
        );
      if (subtitle.ai_translated)
        badges.push(
          '<span style="background: #9966cc; color: #fff; padding: 2px 4px; border-radius: 3px; font-size: 0.7em; margin-left: 4px;">AI</span>'
        );

      const releaseText = subtitle.release || "Release desconhecido";
      const truncatedRelease =
        releaseText.length > 35
          ? releaseText.substring(0, 35) + "..."
          : releaseText;

      button.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
          <div style="font-weight: 500; margin-bottom: 4px;">${truncatedRelease}</div>
          <div style="display: flex; align-items: center; font-size: 0.8em; color: #ccc;">
            <span>Downloads: ${subtitle.download_count || 0}</span>
            ${badges.join("")}
          </div>
        </div>
      `;

      button.style.cssText = `
        display: block;
        width: 100%;
        margin: 6px 0;
        padding: 12px;
        background: ${index === 0 ? "#2a4a2a" : "#2a2a2a"};
        color: #fff;
        border: 1px solid ${index === 0 ? "#4a6a4a" : "#444"};
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9em;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      `;

      if (index === 0) {
        const bestBadge = document.createElement("div");
        bestBadge.textContent = "Recomendada";
        bestBadge.style.cssText = `
          position: absolute;
          top: 4px;
          right: 4px;
          background: #00cc00;
          color: #fff;
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 0.7em;
          font-weight: 600;
        `;
        button.appendChild(bestBadge);
      }

      button.addEventListener("mouseenter", () => {
        button.style.background = index === 0 ? "#3a5a3a" : "#3a3a3a";
        button.style.transform = "translateY(-1px)";
        button.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.3)";
      });

      button.addEventListener("mouseleave", () => {
        button.style.background = index === 0 ? "#2a4a2a" : "#2a2a2a";
        button.style.transform = "translateY(0)";
        button.style.boxShadow = "none";
      });

      button.addEventListener("click", () => {
        const allButtons = container.querySelectorAll("button");
        allButtons.forEach((btn) => {
          btn.disabled = true;
          btn.style.opacity = "0.5";
          btn.style.cursor = "not-allowed";
        });

        button.style.background = "#0066cc";
        button.style.opacity = "1";
        button.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center;">
            <div style="margin-right: 8px;">⏳</div>
            <div>Carregando legenda...</div>
          </div>
        `;

        onSubtitleSelect(subtitle, language);
      });

      langSection.appendChild(button);
    });

    languagesGrid.appendChild(langSection);
  });

  container.appendChild(languagesGrid);

  const info = document.createElement("div");
  info.style.cssText = `
    margin-top: 16px;
    padding: 12px;
    background: #1a1a1a;
    border-radius: 6px;
    border-left: 3px solid #0066cc;
    font-size: 0.85em;
    color: #ccc;
  `;
  info.innerHTML = `
    <strong>💡 Dica:</strong> As legendas são carregadas automaticamente no player.
    Use o botão CC no player para ativar/desativar as legendas após selecionar uma fonte de vídeo.
  `;
  container.appendChild(info);

  return container;
}

// Função para obter emoji da bandeira do país
function getLanguageFlag(code) {
  code = code.toLowerCase();
  const flags = {
    "pt-pt": "🇵🇹",
    "pt-br": "🇧🇷",
    en: "🇺🇸",
    es: "🇪🇸",
    fr: "🇫🇷",
    de: "🇩🇪",
    it: "🇮🇹",
    ru: "🇷🇺",
    ja: "🇯🇵",
    ko: "🇰🇷",
    zh: "🇨🇳",
    ar: "🇸🇦",
    hi: "🇮🇳",
    tr: "🇹🇷",
    pl: "🇵🇱",
    nl: "🇳🇱",
    sv: "🇸🇪",
    da: "🇩🇰",
    no: "🇳🇴",
    fi: "🇫🇮",
  };
  return flags[code] || "🌐";
}

// Função para obter nome do idioma
function getLanguageName(code) {
  code = code.toLowerCase();
  const languages = {
    "pt-pt": "Português",
    "pt-br": "Português (Brasil)",
    en: "English",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    it: "Italiano",
    ru: "Русский",
    ja: "日本語",
    ko: "한국어",
    zh: "中文",
    ar: "العربية",
    hi: "हिन्दी",
    tr: "Türkçe",
    pl: "Polski",
    nl: "Nederlands",
    sv: "Svenska",
    da: "Dansk",
    no: "Norsk",
    fi: "Suomi",
  };
  return languages[code] || code.toUpperCase();
}

// Retorna true se a string de codecs for compatível universalmente (apenas h264/avc)
function isCodecCompatible(bingeGropString) {
  if (!bingeGropString) return false;
  const codecs = bingeGropString.toLowerCase().split("|");
  // Aceita apenas se tiver h264 ou avc e NÃO tiver h265, hevc, vp9, av1
  if (!userAgent.includes("Safari")) {
    return true;
  }
  const hasIncompatible = codecs.some((c) => incompatibleCodecs.includes(c));
  return !hasIncompatible;
}
function isFileExtensionCompatible(filename) {
  if (!filename) return false;
  const ext = filename.toLowerCase().split(".").pop();
  console.log("Verificando extensão do arquivo:", ext, videoExtensions);
  return videoExtensions.includes(`.${ext}`);
}

function isSafari() {
  return userAgent.includes("Safari") && !userAgent.includes("Chrome");
}

async function fetchTorrentioStreams(imdbId, type, season, episode) {
  if (isSafari()) {
    videoExtensions = [".mp4"];
  }
  let torrentioUrl;
  if (type === "series" && season && episode) {
    torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
  } else {
    torrentioUrl = `https://torrentio.strem.fun/stream/${type}/${imdbId}.json`;
  }

  console.log("Fetching Torrentio URL:", torrentioUrl);
  const torrentioRes = await fetch(torrentioUrl);
  const torrentioData = await torrentioRes.json();
  torrentioData.streams = torrentioData.streams || [];
  console.log("Streams do Torrentio recebidos:", torrentioData.streams);
  return torrentioData.streams.filter((s) => {
    return (
      s.infoHash &&
      isFileExtensionCompatible(s.behaviorHints?.filename) &&
      isCodecCompatible(s.behaviorHints.bingeGroup)
    );
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const disablePoster = false;
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
      const spinner = document.createElement("div");
      spinner.id = "player-loading-spinner";
      spinner.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 0"><div class="loading-spinner" style="margin-bottom:16px;"><i class="fas fa-spinner fa-spin fa-3x"></i></div><div style="color:#fff;font-size:1.2em;">Preparando o vídeo, pode demorar até 1 minuto...</div></div>';
      playerContainer.appendChild(spinner);

      let streams = await fetchTorrentioStreams(imdbId, type, season, episode);
      console.log("Streams encontrados no Torrentio:", streams);
      if (!streams.length)
        throw new Error("Nenhum stream encontrado no Torrentio.");

      if (imdbId === "tt1431045") {
        const filtered = streams.filter((s) => {
          const t = (s.title || "").toLowerCase();
          return (
            /^deadpool(\s|$)/.test(t) &&
            !/(x[- ]?men|collection|pack|xmen|x\s?men)/.test(t)
          );
        });
        if (filtered.length) streams = filtered;
      }

      streams = streams.filter((stream) => {
        const t = (stream.title || "").toLowerCase();
        return !(
          t.includes(".rar") ||
          t.includes(".zip") ||
          t.includes(".7z") ||
          t.includes(".txt") ||
          t.includes(".nfo") ||
          t.includes("sample")
        );
      });

      if (!streams.length)
        throw new Error(
          "Nenhum stream de vídeo disponível após a filtragem inicial. Por favor, tente outro título."
        );

      streams.sort((a, b) => {
        const qualityOrder = { "4k": 4, "1080p": 3, "720p": 2, "480p": 1 };
        const aQuality = qualityOrder[a.quality?.toLowerCase()] || 0;
        const bQuality = qualityOrder[b.quality?.toLowerCase()] || 0;
        return bQuality - aQuality;
      });

      spinner.remove();

      console.log("Buscando legendas disponíveis...");
      const availableSubtitles = await fetchSubtitles(
        imdbId,
        type,
        season,
        episode
      );
      console.log("Legendas disponíveis:", availableSubtitles);
      console.log(`Encontradas ${availableSubtitles.length} legendas`);

      playerContainer.innerHTML = `<div style='color:#fff;font-family:sans-serif;padding:16px;'><h2>Escolha uma fonte para assistir:</h2><div id='stream-list'></div></div>`;
      const streamList = document.getElementById("stream-list");

      if (availableSubtitles.length > 0) {
        const subtitlePicker = createSubtitlePicker(
          availableSubtitles,
          async (subtitle, language) => {
            console.log(
              `Legenda selecionada: ${subtitle.release} (${language})`
            );
            window.selectedSubtitle = { subtitle, language };

            const picker = document.getElementById("subtitle-picker");
            if (picker) {
              const successMsg = document.createElement("div");
              successMsg.style.cssText = `
              margin-top: 12px;
              padding: 12px;
              background: #1a4a1a;
              border: 1px solid #4a6a4a;
              border-radius: 6px;
              color: #4ade80;
              font-size: 0.9em;
              display: flex;
              align-items: center;
            `;
              successMsg.innerHTML = `
              <span style="margin-right: 8px;">✅</span>
              <strong>Legenda selecionada:</strong> ${getLanguageName(
                language
              )} - ${subtitle.release || "Legenda"}
            `;
              picker.appendChild(successMsg);
            }
          }
        );

        const containerDiv = playerContainer.querySelector("div");
        containerDiv.insertBefore(subtitlePicker, streamList);
      }

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Pesquisar stream...";
      searchInput.style =
        "margin: 8px 0; padding: 8px; width: 100%; max-width: 400px; font-size: 1em; border-radius: 6px; border: 1px solid #555; background: #111; color: #fff;";
      const containerDiv = playerContainer.querySelector("div");
      containerDiv.insertBefore(searchInput, streamList);

      const normalize = (text) =>
        text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      searchInput.addEventListener("input", () => {
        const filter = normalize(searchInput.value);
        const buttons = streamList.querySelectorAll("button");
        buttons.forEach((btn) => {
          const txt = normalize(btn.textContent);
          btn.style.display = txt.includes(filter) ? "block" : "none";
        });
      });

      streams.forEach((stream) => {
        const btn = document.createElement("button");
        const quality = stream.quality ? ` [${stream.quality}]` : "";
        const titleText = stream.title || "Stream Desconhecido";
        btn.textContent = `${titleText}${quality}`;
        btn.style =
          "display:block;margin:8px 0;padding:10px 16px;font-size:1em;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer;text-align:left;word-break:break-word;";
        btn.onclick = async () => {
          playerContainer.innerHTML = "";
          const loading = document.createElement("div");
          loading.innerHTML =
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 0"><div class="loading-spinner" style="margin-bottom:16px;"><i class="fas fa-spinner fa-spin fa-3x"></i></div><div style="color:#fff;font-size:1.2em;">Preparando o vídeo...</div></div>';
          playerContainer.appendChild(loading);

          let magnet = `magnet:?xt=urn:btih:${stream.infoHash}`;
          const cleanTitle = (stream.title || "")
            .replace(/[\u00000-\u1FAFF\u2600-\u27BF]/gu, "")
            .replace(/\s+/g, " ")
            .replace(/\n/g, "")
            .trim();
          if (cleanTitle) magnet += `&dn=${encodeURIComponent(cleanTitle)}`;

          // A API_BASE_URL já está definida no início do arquivo
          const apiUrl = `${API_BASE_URL.replace(
            /\/$/,
            ""
          )}/stream?magnet=${encodeURIComponent(magnet)}`;

          console.log("Fetching stream from API URL:", apiUrl);
          try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(
                `Erro ao buscar o stream: ${response.status} ${response.statusText}. Resposta: ${errorText}`
              );
            }
            const streamData = await response.json();
            if (!streamData.success || !streamData.url) {
              throw new Error(
                streamData.message ||
                  "Erro ao obter o URL do stream. Sucesso: " +
                    streamData.success +
                    " URL: " +
                    streamData.url
              );
            }

            console.log("Stream URL received:", streamData.url);

            const videoElement = document.createElement("video");
            videoElement.id = "player";
            videoElement.controls = true;
            videoElement.autoplay = true;
            videoElement.muted = true;
            if (poster && !disablePoster) videoElement.poster = poster;
            videoElement.src = streamData.url;
            videoElement.addEventListener("loadeddata", () => {
              loading.remove();
              console.log(
                "Vídeo carregado com sucesso. Metadados disponíveis."
              );
            });
            videoElement.addEventListener("error", (e) => {
              loading.remove();
              console.error("Erro no elemento <video> nativo:", e);
              let videoErrorMessage =
                "O vídeo não pôde ser carregado. Tente outra fonte ou verifique sua conexão.";
              if (videoElement.error) {
                switch (videoElement.error.code) {
                  case videoElement.error.MEDIA_ERR_ABORTED:
                    videoErrorMessage += " (Reprodução abortada pelo usuário).";
                    break;
                  case videoElement.error.MEDIA_ERR_NETWORK:
                    videoErrorMessage += " (Erro de rede durante o download).";
                    break;
                  case videoElement.error.MEDIA_ERR_DECODE:
                    videoErrorMessage +=
                      " (Erro de decodificação de vídeo/áudio).";
                    break;
                  case videoElement.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    videoErrorMessage +=
                      " (Formato de mídia não suportado ou URL inválido).";
                    break;
                  default:
                    videoErrorMessage +=
                      " (Erro desconhecido: " + videoElement.error.code + ").";
                    break;
                }
              }
              showError(
                videoErrorMessage + " URL do stream: " + streamData.url
              );
            });
            playerContainer.appendChild(videoElement);

            if (typeof Plyr !== "undefined") {
              if (window.selectedSubtitle) {
                const { subtitle, language } = window.selectedSubtitle;
                const label = `${getLanguageName(language)} - ${
                  subtitle.release || "Legenda"
                }`;

                try {
                  const downloadUrl = await getSubtitleDownloadUrl(
                    subtitle.file_id
                  );
                  if (downloadUrl) {
                    const proxyUrl = `${API_BASE_URL}/subtitles/proxy?url=${encodeURIComponent(
                      downloadUrl
                    )}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok)
                      throw new Error("Falha ao buscar legenda via proxy.");

                    const srtContent = await response.text();
                    const vttContent = convertSrtToVtt(srtContent);
                    const blob = new Blob([vttContent], { type: "text/vtt" });
                    const blobUrl = URL.createObjectURL(blob);

                    const track = document.createElement("track");
                    track.kind = "subtitles";
                    track.label = label;
                    track.srclang = language;
                    track.src = blobUrl;
                    track.default = true;

                    videoElement.appendChild(track);
                    console.log("Legenda adicionada ao <video> antes do Plyr.");
                  }
                } catch (error) {
                  console.error(
                    "Erro ao carregar legenda antes de iniciar o Plyr:",
                    error
                  );
                }
              }

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

              player.on("ready", () => {
                console.log(
                  "Plyr iniciado com sucesso. Verifica se o botão CC está visível."
                );
                if (player.captions) {
                  player.captions.active = true;
                }
              });

              player.on("error", (event) => {
                console.error("Erro no leitor Plyr:", event);
              });

              player.on("enterfullscreen", () => {
                console.log("Entrou em fullscreen");
                videoElement.style.setProperty(
                  "object-fit",
                  "cover",
                  "important"
                );
                videoElement.style.setProperty("width", "100%", "important");
                videoElement.style.setProperty("height", "100%", "important");
                videoElement.style.setProperty(
                  "max-width",
                  "none",
                  "important"
                );
                videoElement.style.setProperty(
                  "max-height",
                  "none",
                  "important"
                );
              });

              player.on("exitfullscreen", () => {
                console.log("Saiu do fullscreen");
              });
            }
          } catch (error) {
            console.error(
              "Erro ao preparar o stream (depois da seleção da fonte):",
              error
            );
            showError(
              error.message ||
                "Erro ao preparar o vídeo. Por favor, tente outra fonte."
            );
          }
        };
        streamList.appendChild(btn);
      });
    } catch (error) {
      console.error(
        "Erro geral ao preparar o stream (antes da seleção da fonte):",
        error
      );
      showError(
        error.message ||
          "Erro ao preparar o vídeo. Por favor, recarregue a página e tente novamente."
      );
    }
  } else {
    showError("Faltam informações (ID ou tipo) para carregar o vídeo.");
  }
});
