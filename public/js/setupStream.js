const axios = require("axios");
const https = require("https");

const REAL_DEBRID_TOKEN =
  "2RHUYGEFBFKUNIKQSUDID2NUIG4MDBOWRD2AFQL3Y6ZOVISI7OSQ";

/**
 * Handler Express para preparar o link Real-Debrid e fazer proxy do vídeo.
 * Endpoint: /api/stream?magnet=...
 */
async function streamHandler(req, res) {
  const { magnet } = req.query;
  if (!magnet) {
    return res.status(400).json({
      success: false,
      message: "Magnet link obrigatório na query (?magnet=...)",
    });
  }
  try {
    // 1. Adicionar magnet ao Real-Debrid
    const { data: addedMagnetData } = await axios.post(
      "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
      `magnet=${encodeURIComponent(magnet)}`,
      {
        headers: {
          Authorization: `Bearer ${REAL_DEBRID_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    const torrentId = addedMagnetData.id;
    // 2. Poll até estar pronto
    let torrentInfo;
    for (let attempts = 0; attempts < 25; attempts++) {
      await new Promise((r) => setTimeout(r, 5000));
      const { data: info } = await axios.get(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
        { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
      );
      torrentInfo = info;
      if (
        torrentInfo.status === "downloaded" &&
        torrentInfo.links?.length > 0
      ) {
        break;
      } else if (torrentInfo.status === "waiting_files_selection") {
        const mp4Files = (torrentInfo.files || [])
          .filter((f) => /\.mp4$/i.test(f.path) && f.bytes > 10_000_000)
          .sort((a, b) => b.bytes - a.bytes);
        if (mp4Files.length > 0) {
          await axios.post(
            `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
            `files=${mp4Files.map((f) => f.id).join(",")}`,
            {
              headers: {
                Authorization: `Bearer ${REAL_DEBRID_TOKEN}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );
        } else {
          await axios.delete(
            `https://api.real-debrid.com/rest/1.0/torrents/delete/${torrentId}`,
            { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
          );
          return res.status(404).json({
            success: false,
            message: "Nenhum ficheiro MP4 válido encontrado.",
          });
        }
      } else if (
        ["magnet_error", "error", "dead"].includes(torrentInfo.status)
      ) {
        return res.status(500).json({
          success: false,
          message: `Erro no torrent RD: ${
            torrentInfo.error || torrentInfo.status
          }`,
        });
      }
    }
    if (!torrentInfo.links || !torrentInfo.links[0]) {
      return res.status(404).json({
        success: false,
        message: "Nenhum link disponível no Real-Debrid.",
      });
    }
    // 3. Unrestrict link para obter link direto
    const { data: unrestrictedData } = await axios.post(
      "https://api.real-debrid.com/rest/1.0/unrestrict/link",
      `link=${torrentInfo.links[0]}`,
      {
        headers: {
          Authorization: `Bearer ${REAL_DEBRID_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    const finalStreamUrl = unrestrictedData.download;
    // 4. Proxy do vídeo para o cliente
    const agent = new https.Agent({ rejectUnauthorized: false });
    const videoResponse = await axios({
      method: "get",
      url: finalStreamUrl,
      responseType: "stream",
      headers: {
        Range: req.headers.range || "bytes=0-",
      },
      httpsAgent: agent,
    });
    res.writeHead(videoResponse.status, videoResponse.headers);
    videoResponse.data.pipe(res);
  } catch (error) {
    const message = error.response
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error(`[STREAM] Erro ao preparar/proxy stream:`, message);
    res.status(500).send("Erro ao preparar ou obter o vídeo.");
  }
}

module.exports = { streamHandler };
