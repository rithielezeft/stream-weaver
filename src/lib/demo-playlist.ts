import type { Channel } from "./m3u";

import posterNeon from "@/assets/poster-neon.jpg";
import posterHorizonte from "@/assets/poster-horizonte.jpg";
import posterFutebol from "@/assets/poster-futebol.jpg";
import posterBoxe from "@/assets/poster-boxe.jpg";
import posterNews from "@/assets/poster-news.jpg";
import posterEconomia from "@/assets/poster-economia.jpg";
import posterFox from "@/assets/poster-fox.jpg";
import posterRobot from "@/assets/poster-robot.jpg";

/**
 * Catálogo de demonstração com streams HLS públicos de teste.
 */
export const demoChannels: Channel[] = [
  {
    id: "neon-noturno",
    name: "Neon Noturno",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    group: "Filmes",
    poster: posterNeon,
    meta: "Thriller · 2024",
  },
  {
    id: "ultimo-horizonte",
    name: "O Último Horizonte",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    group: "Filmes",
    poster: posterHorizonte,
    meta: "Sci-Fi · 2023",
  },
  {
    id: "gol-total",
    name: "Gol Total",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    group: "Esportes",
    poster: posterFutebol,
    meta: "Futebol · 20h00",
    live: true,
  },
  {
    id: "rincao",
    name: "Rincaço",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    group: "Esportes",
    poster: posterBoxe,
    meta: "Boxe · 22h00",
  },
  {
    id: "meridiano-24",
    name: "Meridiano 24",
    url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_hevc/master.m3u8",
    group: "Notícias",
    poster: posterNews,
    meta: "Jornalismo · 24h",
    live: true,
  },
  {
    id: "balcao-aberto",
    name: "Balcão Aberto",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    group: "Notícias",
    poster: posterEconomia,
    meta: "Economia · 18h00",
  },
  {
    id: "astro-brum",
    name: "Astro Brum",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    group: "Infantil",
    poster: posterFox,
    meta: "Animação · 4+",
  },
  {
    id: "robo-zeca",
    name: "Robo Zeca",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    group: "Infantil",
    poster: posterRobot,
    meta: "Animação · 4+",
  },
];
