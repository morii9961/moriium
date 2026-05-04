import Key from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";


const nameToKey: Record<string, Key> = {
    home: Key.home,
    archive: Key.archive,
    about: Key.about,
    search: Key.search,
    friends: Key.friends,
    exhibition: Key.exhibition,
    projects: Key.projects,
    skills: Key.skills,
    timeline: Key.timeline,
    diary: Key.diary,
    albums: Key.albums,
    anime: Key.anime,
};

export function translateNavName(name: string): string {
    const key = nameToKey[name.toLowerCase()];
    return key !== undefined ? i18n(key) : name;
}
