# Roadmap

- [x] Player M3U estilo Netflix (Aurora Glass): catálogo, hero, importação M3U, player HLS
- [ ] Compatibilidade ampla de streams:
  - [x] MPEG-TS progressivo (.ts) via mpegts.js
  - [x] HLS com config tolerante (H.264/AAC, VP8/VP9 quando o navegador suportar via MSE)
  - [x] Fallbacks e retentativas em erros de rede fatais
  - [x] Aviso honesto sobre TLS autoassinado (navegador bloqueia; JS não contorna)
- [x] Bug: importação de lista (arquivo/texto/URL) travando — era build quebrado; testado e funcionando
- [x] Importação real: download de URL pelo servidor, arquivo com seleção/progresso, limites e catálogo sem dados fictícios
