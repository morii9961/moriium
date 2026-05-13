import type { APIRoute } from "astro";

export const prerender = false;

const NETEASE_API = "https://music.163.com/api";
const NETEASE_WEB = "https://music.163.com";

type NeteaseSong = {
    id: number | string;
    name?: string;
    duration?: number;
    dt?: number;
    album?: {
        name?: string;
        picUrl?: string;
        blurPicUrl?: string;
    };
    al?: {
        name?: string;
        picUrl?: string;
    };
    artists?: Array<{ name?: string }>;
    ar?: Array<{ name?: string }>;
};

type MetingTrack = {
    id: string;
    title: string;
    author: string;
    url: string;
    pic: string;
    lrc: string;
    duration: number;
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
        ...init,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            ...corsHeaders,
            ...init?.headers,
        },
    });
}

function error(message: string, status = 400) {
    return json({ error: message }, { status });
}

function normalizeIds(id: string) {
    return id
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function neteaseHeaders() {
    return {
        Referer: NETEASE_WEB,
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    };
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        headers: neteaseHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Netease request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
}

async function fetchLyrics(id: string) {
    try {
        const url = `${NETEASE_API}/song/lyric?id=${encodeURIComponent(id)}&lv=1&kv=1&tv=-1`;
        const data = await fetchJson<{ lrc?: { lyric?: string } }>(url);
        return data.lrc?.lyric ?? "";
    } catch {
        return "";
    }
}

async function fetchPlayableUrl(id: string, br: string) {
    try {
        const ids = encodeURIComponent(JSON.stringify([Number(id)]));
        const url = `${NETEASE_API}/song/enhance/player/url?ids=${ids}&br=${encodeURIComponent(br)}`;
        const data = await fetchJson<{ data?: Array<{ url?: string }> }>(url);
        const playableUrl = data.data?.[0]?.url;
        if (playableUrl) return playableUrl.replace(/^http:\/\//, "https://");
    } catch {
        // Fall back to the public outer URL below.
    }

    return `${NETEASE_WEB}/song/media/outer/url?id=${encodeURIComponent(id)}.mp3`;
}

function songArtists(song: NeteaseSong) {
    const artists = song.artists ?? song.ar ?? [];
    return artists.map((artist) => artist.name).filter(Boolean).join(" / ") || "Unknown Artist";
}

async function toMetingTrack(song: NeteaseSong, br: string): Promise<MetingTrack> {
    const id = String(song.id);
    return {
        id,
        title: song.name || "Unknown Title",
        author: songArtists(song),
        url: await fetchPlayableUrl(id, br),
        pic: song.album?.picUrl ?? song.album?.blurPicUrl ?? song.al?.picUrl ?? "",
        lrc: await fetchLyrics(id),
        duration: Math.floor((song.duration ?? song.dt ?? 0) / 1000),
    };
}

async function getSongs(ids: string[], br: string) {
    const numericIds = ids.map((id) => Number(id)).filter(Number.isFinite);
    if (numericIds.length === 0) return [];

    const detailUrl = `${NETEASE_API}/song/detail/?ids=${encodeURIComponent(JSON.stringify(numericIds))}`;
    const data = await fetchJson<{ songs?: NeteaseSong[] }>(detailUrl);
    const songs = data.songs ?? [];
    return Promise.all(songs.map((song) => toMetingTrack(song, br)));
}

async function getPlaylist(id: string, br: string) {
    const playlistUrl = `${NETEASE_API}/playlist/detail?id=${encodeURIComponent(id)}`;
    const data = await fetchJson<{
        playlist?: {
            tracks?: NeteaseSong[];
            trackIds?: Array<{ id: number | string }>;
        };
    }>(playlistUrl);

    const tracks = data.playlist?.tracks ?? [];
    if (tracks.length > 0) {
        return Promise.all(tracks.map((song) => toMetingTrack(song, br)));
    }

    const ids = (data.playlist?.trackIds ?? []).map((item) => String(item.id));
    return getSongs(ids, br);
}

async function getAlbum(id: string, br: string) {
    const albumUrl = `${NETEASE_API}/album/${encodeURIComponent(id)}`;
    const data = await fetchJson<{ songs?: NeteaseSong[] }>(albumUrl);
    return Promise.all((data.songs ?? []).map((song) => toMetingTrack(song, br)));
}

export const OPTIONS: APIRoute = async () =>
    new Response(null, {
        status: 204,
        headers: corsHeaders,
    });

export const GET: APIRoute = async ({ url }) => {
    const server = url.searchParams.get("server") ?? "netease";
    const type = url.searchParams.get("type") ?? "song";
    const id = url.searchParams.get("id");
    const br = url.searchParams.get("br") ?? "320000";

    if (server !== "netease") {
        return error('Only server="netease" is supported.');
    }

    if (!id) {
        return error("Missing required query parameter: id");
    }

    try {
        if (type === "song") {
            return json(await getSongs(normalizeIds(id), br));
        }

        if (type === "playlist") {
            return json(await getPlaylist(id, br));
        }

        if (type === "album") {
            return json(await getAlbum(id, br));
        }

        return error('Unsupported type. Use "song", "playlist", or "album".');
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Unknown error";
        return error(message, 502);
    }
};
