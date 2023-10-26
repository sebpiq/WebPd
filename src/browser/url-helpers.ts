/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

export const urlDirName = (url: string): string => {
    if (isExternalUrl(url)) {
        return new URL('.', url).href;
    } else {
        return new URL('.', new URL(url, document.URL).href).href;
    }
}

// REF : https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative
export const isExternalUrl = (urlString: string) => {
    try {
        const url = new URL(urlString);
        if (url.origin !== new URL(document.URL, document.baseURI).origin) {
            return true;
        }
    } catch (_e) {
        new URL(urlString, document.baseURI);
    }
    return false;
};
