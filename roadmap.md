# Roadmap

- [x] Player M3U estilo Netflix (Aurora Glass): catálogo, hero, importação M3U, player HLS
- [x] Compatibilidade ampla de streams:
  - [x] MPEG-TS progressivo (.ts) via mpegts.js (com retentativa em erro de rede)
  - [x] HLS com config tolerante (H.264/AAC, VP8/VP9 quando o navegador suportar via MSE)
  - [x] Fallbacks e retentativas em erros de rede fatais
  - [x] Aviso honesto sobre TLS autoassinado (navegador bloqueia; JS não contorna)
- [x] Relay same-origin `/api/public/stream-proxy`: resolve mixed content (HTTP em página HTTPS) e CORS; reescrita de manifestos HLS e streaming binário MPEG-TS
- [x] URLs sem extensão: probe de content-type/bytes antes de escolher o motor (hls.js / mpegts.js / nativo) — sem header Range (servidores IPTV respondem 416)
- [x] Bug: importação de lista (arquivo/texto/URL) travando — era build quebrado; testado e funcionando
- [x] Importação real: download de URL pelo servidor, arquivo com seleção/progresso, limites e catálogo sem dados fictícios
